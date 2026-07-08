using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Infrastructure.Auth;

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
        IHostEnvironment hostEnvironment,
        ICurrentSupabaseUserAccessor currentUserAccessor,
        ILeaderboardRepository leaderboardRepository,
        IPremiumRepository premiumRepository,
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
            var premiumState = await premiumRepository.GetPremiumStateAsync(user.UserId, cancellationToken);
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
