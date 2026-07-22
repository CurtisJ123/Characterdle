using System.Text;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Infrastructure.Auth;
using Stripe;
using Stripe.Checkout;

namespace Characterdle.Server.Features.Billing;

public static class BillingEndpoints
{
    public static IEndpointRouteBuilder MapBillingEndpoints(this IEndpointRouteBuilder app)
    {
        var billing = app.MapGroup("/api/billing").WithTags("Billing");

        billing.MapPost("/checkout", CreateCheckoutSessionAsync)
            .WithName("CreateBillingCheckoutSession")
            .Produces<BillingSessionResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        billing.MapPost("/portal", CreatePortalSessionAsync)
            .WithName("CreateBillingPortalSession")
            .Produces<BillingSessionResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status409Conflict)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        billing.MapPost("/webhook", HandleWebhookAsync)
            .WithName("HandleStripeWebhook")
            .Produces(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    private static async Task<IResult> CreateCheckoutSessionAsync(
        CreateBillingCheckoutSessionRequest request,
        ICurrentSupabaseUserAccessor currentUserAccessor,
        ILeaderboardRepository leaderboardRepository,
        IPremiumRepository premiumRepository,
        IBillingRepository billingRepository,
        StripeBillingService stripeBillingService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await currentUserAccessor.GetCurrentUserAsync(cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            if (!TryParsePlan(request.Plan, out var plan))
            {
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["plan"] = ["Plan must be either 'monthly' or 'yearly'."],
                });
            }

            if (await premiumRepository.HasActiveSubscriptionAsync(user.UserId, cancellationToken))
            {
                return Results.Conflict(new
                {
                    detail = "You already have premium access. Use Manage Billing instead.",
                });
            }

            var includeMonthlyTrial = plan == BillingCheckoutPlan.Monthly
                && !await billingRepository.HasStartedPremiumAsync(user.UserId, cancellationToken);

            await leaderboardRepository.EnsurePlayerProfileAsync(user, cancellationToken);

            var stripeCustomerId = await billingRepository.GetStripeCustomerIdAsync(user.UserId, cancellationToken);

            if (string.IsNullOrWhiteSpace(stripeCustomerId))
            {
                stripeCustomerId = await stripeBillingService.CreateCustomerAsync(user, cancellationToken);
                await billingRepository.UpsertStripeCustomerIdAsync(user.UserId, stripeCustomerId, cancellationToken);
            }

            var session = await stripeBillingService.CreateCheckoutSessionAsync(
                user,
                stripeCustomerId,
                plan,
                includeMonthlyTrial,
                cancellationToken);
            return Results.Ok(session);
        }
        catch (InvalidOperationException exception)
        {
            return Results.Problem(
                title: "Unable to start checkout.",
                detail: exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (StripeException exception)
        {
            var logger = loggerFactory.CreateLogger(typeof(BillingEndpoints).FullName!);
            logger.LogError(exception, "Stripe checkout session creation failed.");

            return Results.Problem(
                title: "Unable to start checkout.",
                detail: exception.StripeError?.Message ?? exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(BillingEndpoints).FullName!);
            logger.LogError(exception, "Billing checkout request failed.");

            return Results.Problem(
                title: "Unable to start checkout.",
                detail: "The billing request failed.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> CreatePortalSessionAsync(
        ICurrentSupabaseUserAccessor currentUserAccessor,
        ILeaderboardRepository leaderboardRepository,
        IBillingRepository billingRepository,
        StripeBillingService stripeBillingService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await currentUserAccessor.GetCurrentUserAsync(cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            await leaderboardRepository.EnsurePlayerProfileAsync(user, cancellationToken);
            var stripeCustomerId = await billingRepository.GetStripeCustomerIdAsync(user.UserId, cancellationToken);

            if (string.IsNullOrWhiteSpace(stripeCustomerId))
            {
                return Results.Conflict(new
                {
                    detail = "No billing account was found for this user yet.",
                });
            }

            var session = await stripeBillingService.CreatePortalSessionAsync(stripeCustomerId, cancellationToken);
            return Results.Ok(session);
        }
        catch (InvalidOperationException exception)
        {
            return Results.Problem(
                title: "Unable to open billing portal.",
                detail: exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (StripeException exception)
        {
            var logger = loggerFactory.CreateLogger(typeof(BillingEndpoints).FullName!);
            logger.LogError(exception, "Stripe billing portal session creation failed.");

            return Results.Problem(
                title: "Unable to open billing portal.",
                detail: exception.StripeError?.Message ?? exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(BillingEndpoints).FullName!);
            logger.LogError(exception, "Billing portal request failed.");

            return Results.Problem(
                title: "Unable to open billing portal.",
                detail: "The billing request failed.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> HandleWebhookAsync(
        HttpRequest httpRequest,
        IBillingRepository billingRepository,
        StripeBillingService stripeBillingService,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        var logger = loggerFactory.CreateLogger(typeof(BillingEndpoints).FullName!);

        try
        {
            if (!httpRequest.Headers.TryGetValue("Stripe-Signature", out var signatureValues))
            {
                return Results.BadRequest(new
                {
                    detail = "Stripe-Signature header is required.",
                });
            }

            string payload;

            using (var reader = new StreamReader(httpRequest.Body, Encoding.UTF8))
            {
                payload = await reader.ReadToEndAsync(cancellationToken);
            }

            var stripeEvent = stripeBillingService.ConstructWebhookEvent(payload, signatureValues.ToString());

            if (await billingRepository.HasProcessedWebhookEventAsync(stripeEvent.Id, cancellationToken))
            {
                return Results.Ok();
            }

            switch (stripeEvent.Type)
            {
                case "checkout.session.completed":
                    await HandleCheckoutCompletedAsync(
                        stripeEvent.Data.Object as Session,
                        billingRepository,
                        stripeBillingService,
                        cancellationToken);
                    break;

                case "customer.subscription.created":
                case "customer.subscription.updated":
                case "customer.subscription.deleted":
                    await HandleSubscriptionUpdatedAsync(
                        stripeEvent.Data.Object as Subscription,
                        billingRepository,
                        stripeEvent.Type,
                        cancellationToken);
                    break;
            }

            await billingRepository.RecordProcessedWebhookEventAsync(
                stripeEvent.Id,
                stripeEvent.Type,
                cancellationToken);

            return Results.Ok();
        }
        catch (StripeException exception)
        {
            logger.LogError(exception, "Stripe webhook handling failed.");
            return Results.BadRequest(new
            {
                detail = exception.StripeError?.Message ?? exception.Message,
            });
        }
        catch (InvalidOperationException exception)
        {
            logger.LogError(exception, "Stripe webhook configuration error.");
            return Results.Problem(
                title: "Unable to process billing webhook.",
                detail: exception.Message,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            logger.LogError(exception, "Unexpected billing webhook failure.");
            return Results.Problem(
                title: "Unable to process billing webhook.",
                detail: "The billing webhook failed.",
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task HandleCheckoutCompletedAsync(
        Session? session,
        IBillingRepository billingRepository,
        StripeBillingService stripeBillingService,
        CancellationToken cancellationToken)
    {
        if (session is null || !string.Equals(session.Mode, "subscription", StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        var userId = TryParseGuid(session.ClientReferenceId)
            ?? TryParseGuid(stripeBillingService.TryReadUserIdMetadata(session));

        if (userId.HasValue && !string.IsNullOrWhiteSpace(session.CustomerId))
        {
            await billingRepository.UpsertStripeCustomerIdAsync(userId.Value, session.CustomerId, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(session.SubscriptionId))
        {
            return;
        }

        var subscription = await stripeBillingService.GetSubscriptionAsync(session.SubscriptionId, cancellationToken);
        await HandleSubscriptionUpdatedAsync(
            subscription,
            billingRepository,
            "checkout.session.completed",
            cancellationToken,
            userId);
    }

    private static async Task HandleSubscriptionUpdatedAsync(
        Subscription? subscription,
        IBillingRepository billingRepository,
        string eventType,
        CancellationToken cancellationToken,
        Guid? fallbackUserId = null)
    {
        if (subscription is null)
        {
            return;
        }

        var userId = TryParseGuid(subscription.Metadata.TryGetValue("characterdle_user_id", out var rawUserId) ? rawUserId : null)
            ?? fallbackUserId;

        if (!userId.HasValue && !string.IsNullOrWhiteSpace(subscription.CustomerId))
        {
            userId = await billingRepository.GetUserIdByStripeCustomerIdAsync(subscription.CustomerId, cancellationToken);
        }

        if (!userId.HasValue)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(subscription.CustomerId))
        {
            await billingRepository.UpsertStripeCustomerIdAsync(userId.Value, subscription.CustomerId, cancellationToken);
        }

        var isDeletedEvent = string.Equals(
            eventType,
            "customer.subscription.deleted",
            StringComparison.OrdinalIgnoreCase);
        var currentPeriodStart = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodStart;
        var currentPeriodEnd = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd ?? subscription.TrialEnd;
        var cancelAt = isDeletedEvent ? null : subscription.CancelAt;
        var premiumEndedAt = ResolvePremiumEndedAt(subscription, isDeletedEvent);
        var effectiveCurrentPeriodEnd = ResolveCurrentPeriodEnd(
            subscription,
            currentPeriodEnd,
            premiumEndedAt,
            isDeletedEvent);
        var isPremium = IsPremiumStatus(
            subscription.Status,
            effectiveCurrentPeriodEnd,
            cancelAt,
            subscription.CancelAtPeriodEnd,
            premiumEndedAt,
            isDeletedEvent);
        var snapshot = new StripePremiumStatusSnapshot(
            StripeCustomerId: subscription.CustomerId,
            StripeSubscriptionId: subscription.Id,
            Status: NormalizeStoredSubscriptionStatus(subscription.Status),
            IsPremium: isPremium,
            CurrentPeriodStart: currentPeriodStart,
            CurrentPeriodEnd: effectiveCurrentPeriodEnd,
            CancelAt: cancelAt,
            CancelAtPeriodEnd: isDeletedEvent ? false : subscription.CancelAtPeriodEnd,
            PremiumStartedAt: isPremium ? currentPeriodStart ?? subscription.TrialStart ?? subscription.StartDate : subscription.StartDate,
            PremiumEndedAt: premiumEndedAt);

        await billingRepository.UpsertPremiumStatusAsync(userId.Value, snapshot, cancellationToken);
    }

    private static bool TryParsePlan(string? rawValue, out BillingCheckoutPlan plan)
    {
        if (string.Equals(rawValue?.Trim(), "monthly", StringComparison.OrdinalIgnoreCase))
        {
            plan = BillingCheckoutPlan.Monthly;
            return true;
        }

        if (string.Equals(rawValue?.Trim(), "yearly", StringComparison.OrdinalIgnoreCase))
        {
            plan = BillingCheckoutPlan.Yearly;
            return true;
        }

        plan = default;
        return false;
    }

    private static bool IsPremiumStatus(
        string? status,
        DateTimeOffset? currentPeriodEnd,
        DateTimeOffset? cancelAt,
        bool cancelAtPeriodEnd,
        DateTimeOffset? premiumEndedAt,
        bool isDeletedEvent)
    {
        if (isDeletedEvent)
        {
            return false;
        }

        if (premiumEndedAt.HasValue && premiumEndedAt.Value <= DateTimeOffset.UtcNow)
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(status))
        {
            return false;
        }

        return status switch
        {
            "active" => true,
            "trialing" => true,
            "past_due" => true,
            "canceled" => PremiumStatusEvaluator.ResolveScheduledCancellationAt(
                    cancelAtPeriodEnd,
                    currentPeriodEnd,
                    cancelAt) is { } scheduledCancellationAt
                && scheduledCancellationAt > DateTimeOffset.UtcNow,
            _ => false,
        };
    }

    private static DateTimeOffset? ResolvePremiumEndedAt(
        Subscription subscription,
        bool isDeletedEvent)
    {
        if (isDeletedEvent)
        {
            return subscription.EndedAt
                ?? subscription.CanceledAt
                ?? DateTimeOffset.UtcNow;
        }

        var currentPeriodEnd = subscription.Items?.Data?.FirstOrDefault()?.CurrentPeriodEnd ?? subscription.TrialEnd;
        var isPremium = IsPremiumStatus(
            subscription.Status,
            currentPeriodEnd,
            subscription.CancelAt,
            subscription.CancelAtPeriodEnd,
            premiumEndedAt: null,
            isDeletedEvent: false);

        return isPremium
            ? null
            : subscription.CanceledAt ?? subscription.EndedAt ?? (DateTimeOffset?)DateTimeOffset.UtcNow;
    }

    private static DateTimeOffset? ResolveCurrentPeriodEnd(
        Subscription subscription,
        DateTimeOffset? currentPeriodEnd,
        DateTimeOffset? premiumEndedAt,
        bool isDeletedEvent)
    {
        if (!isDeletedEvent)
        {
            return currentPeriodEnd;
        }

        return premiumEndedAt
            ?? subscription.EndedAt
            ?? subscription.CanceledAt
            ?? currentPeriodEnd
            ?? DateTimeOffset.UtcNow;
    }

    private static string NormalizeStoredSubscriptionStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
        {
            return "inactive";
        }

        return status.Trim().ToLowerInvariant() switch
        {
            "active" => "active",
            "trialing" => "trialing",
            "past_due" => "past_due",
            "canceled" => "canceled",
            _ => "inactive",
        };
    }

    private static Guid? TryParseGuid(string? rawValue) =>
        Guid.TryParse(rawValue, out var parsedValue)
            ? parsedValue
            : null;
}
