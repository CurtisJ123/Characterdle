using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Leaderboard;
using Microsoft.Extensions.Options;
using Stripe;
using Stripe.BillingPortal;
using Stripe.Checkout;

namespace Characterdle.Server.Features.Billing;

public sealed class StripeBillingService(IOptions<StripeOptions> options)
{
    private const string UserIdMetadataKey = "characterdle_user_id";
    private const string PlanMetadataKey = "characterdle_plan";

    public bool IsBillingConfigured =>
        !string.IsNullOrWhiteSpace(options.Value.SecretKey)
        && !string.IsNullOrWhiteSpace(options.Value.SuccessUrl)
        && !string.IsNullOrWhiteSpace(options.Value.CancelUrl)
        && !string.IsNullOrWhiteSpace(options.Value.PortalReturnUrl)
        && !string.IsNullOrWhiteSpace(options.Value.MonthlyPriceId)
        && !string.IsNullOrWhiteSpace(options.Value.YearlyPriceId);

    public bool IsWebhookConfigured =>
        !string.IsNullOrWhiteSpace(options.Value.SecretKey)
        && !string.IsNullOrWhiteSpace(options.Value.WebhookSecret);

    public async Task<string> CreateCustomerAsync(
        VerifiedSupabaseUser user,
        CancellationToken cancellationToken)
    {
        var service = new CustomerService(CreateClient());
        var customer = await service.CreateAsync(new CustomerCreateOptions
        {
            Email = user.Email,
            Name = user.DisplayName,
            Metadata = new Dictionary<string, string>
            {
                [UserIdMetadataKey] = user.UserId.ToString(),
            },
        }, cancellationToken: cancellationToken);

        return customer.Id;
    }

    public async Task<BillingSessionResponse> CreateCheckoutSessionAsync(
        VerifiedSupabaseUser user,
        string stripeCustomerId,
        BillingCheckoutPlan plan,
        CancellationToken cancellationToken)
    {
        EnsureBillingConfigured();

        var resolvedPriceId = ResolvePriceId(plan);
        var resolvedPlanCode = plan == BillingCheckoutPlan.Yearly ? "yearly" : "monthly";
        var subscriptionMetadata = new Dictionary<string, string>
        {
            [UserIdMetadataKey] = user.UserId.ToString(),
            [PlanMetadataKey] = resolvedPlanCode,
        };
        var checkoutOptions = new Stripe.Checkout.SessionCreateOptions
        {
            AllowPromotionCodes = true,
            CancelUrl = options.Value.CancelUrl,
            ClientReferenceId = user.UserId.ToString(),
            Customer = stripeCustomerId,
            LineItems =
            [
                new Stripe.Checkout.SessionLineItemOptions
                {
                    Price = resolvedPriceId,
                    Quantity = 1,
                },
            ],
            Metadata = new Dictionary<string, string>(subscriptionMetadata),
            Mode = "subscription",
            SuccessUrl = options.Value.SuccessUrl,
            SubscriptionData = new Stripe.Checkout.SessionSubscriptionDataOptions
            {
                Metadata = subscriptionMetadata,
            },
        };

        if (plan == BillingCheckoutPlan.Monthly && options.Value.MonthlyTrialDays > 0)
        {
            checkoutOptions.SubscriptionData.TrialPeriodDays = options.Value.MonthlyTrialDays;
        }

        var service = new Stripe.Checkout.SessionService(CreateClient());
        var session = await service.CreateAsync(checkoutOptions, cancellationToken: cancellationToken);

        if (string.IsNullOrWhiteSpace(session.Url))
        {
            throw new InvalidOperationException("Stripe checkout did not return a redirect URL.");
        }

        return new BillingSessionResponse(session.Url);
    }

    public async Task<BillingSessionResponse> CreatePortalSessionAsync(
        string stripeCustomerId,
        CancellationToken cancellationToken)
    {
        EnsureBillingConfigured();

        var service = new Stripe.BillingPortal.SessionService(CreateClient());
        var session = await service.CreateAsync(new Stripe.BillingPortal.SessionCreateOptions
        {
            Customer = stripeCustomerId,
            ReturnUrl = options.Value.PortalReturnUrl,
        }, cancellationToken: cancellationToken);

        if (string.IsNullOrWhiteSpace(session.Url))
        {
            throw new InvalidOperationException("Stripe billing portal did not return a redirect URL.");
        }

        return new BillingSessionResponse(session.Url);
    }

    public Event ConstructWebhookEvent(
        string payload,
        string stripeSignature)
    {
        EnsureWebhookConfigured();
        return EventUtility.ConstructEvent(payload, stripeSignature, options.Value.WebhookSecret);
    }

    public async Task<Subscription> GetSubscriptionAsync(
        string subscriptionId,
        CancellationToken cancellationToken)
    {
        EnsureBillingConfigured();
        var service = new SubscriptionService(CreateClient());
        return await service.GetAsync(subscriptionId, cancellationToken: cancellationToken);
    }

    public string? TryReadUserIdMetadata(IHasMetadata stripeObject)
    {
        if (!stripeObject.Metadata.TryGetValue(UserIdMetadataKey, out var rawUserId))
        {
            return null;
        }

        return string.IsNullOrWhiteSpace(rawUserId)
            ? null
            : rawUserId.Trim();
    }

    private void EnsureBillingConfigured()
    {
        if (!IsBillingConfigured)
        {
            throw new InvalidOperationException("Stripe billing is not fully configured.");
        }
    }

    private void EnsureWebhookConfigured()
    {
        if (!IsWebhookConfigured)
        {
            throw new InvalidOperationException("Stripe webhook handling is not fully configured.");
        }
    }

    private StripeClient CreateClient()
    {
        if (string.IsNullOrWhiteSpace(options.Value.SecretKey))
        {
            throw new InvalidOperationException("Stripe secret key is not configured.");
        }

        return new StripeClient(options.Value.SecretKey);
    }

    private string ResolvePriceId(BillingCheckoutPlan plan) =>
        plan switch
        {
            BillingCheckoutPlan.Monthly when !string.IsNullOrWhiteSpace(options.Value.MonthlyPriceId) => options.Value.MonthlyPriceId,
            BillingCheckoutPlan.Yearly when !string.IsNullOrWhiteSpace(options.Value.YearlyPriceId) => options.Value.YearlyPriceId,
            BillingCheckoutPlan.Monthly => throw new InvalidOperationException("Stripe monthly price ID is not configured."),
            BillingCheckoutPlan.Yearly => throw new InvalidOperationException("Stripe yearly price ID is not configured."),
            _ => throw new InvalidOperationException("Unsupported billing plan."),
        };
}
