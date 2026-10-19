using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Billing;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.Extensions.Options;

namespace Characterdle.Server.Features.Premium;

public static class PremiumEndpoints
{
    public static IEndpointRouteBuilder MapPremiumEndpoints(this IEndpointRouteBuilder app)
    {
        var premium = app.MapGroup("/api/premium").WithTags("Premium");

        premium.MapGet("/", GetPremiumStateAsync)
            .WithName("GetPremiumState")
            .Produces<PremiumStateResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    private static async Task<IResult> GetPremiumStateAsync(
        HttpResponse response,
        IHostEnvironment hostEnvironment,
        ICurrentSupabaseUserAccessor currentUserAccessor,
        ILeaderboardRepository leaderboardRepository,
        IPremiumRepository premiumRepository,
        IBillingRepository billingRepository,
        IOptions<StripeOptions> stripeOptions,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        response.Headers.CacheControl = "no-store";
        response.Headers.Vary = "Authorization";
        try
        {
            var user = await currentUserAccessor.GetCurrentUserAsync(cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            await leaderboardRepository.EnsurePlayerProfileAsync(user, cancellationToken);
            var premiumState = await premiumRepository.GetPremiumStateAsync(user.UserId, cancellationToken);
            var monthlyTrialDays = Math.Max(0, stripeOptions.Value.MonthlyTrialDays);
            var yearlyTrialDays = Math.Max(0, stripeOptions.Value.YearlyTrialDays);
            var isTrialEligible = !premiumState.Access.IsPremium && (monthlyTrialDays > 0 || yearlyTrialDays > 0)
                && !await billingRepository.HasStartedPremiumAsync(user.UserId, cancellationToken);
            premiumState = premiumState with
            {
                Access = premiumState.Access with
                {
                    MonthlyTrialDays = isTrialEligible ? monthlyTrialDays : 0,
                    YearlyTrialDays = isTrialEligible ? yearlyTrialDays : 0,
                }
            };
            return Results.Ok(premiumState);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(PremiumEndpoints).FullName!);
            logger.LogError(exception, "Unable to load premium state.");

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading premium access.";

            return Results.Problem(
                title: "Unable to load premium access.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

}
