using Characterdle.Server.Features.Leaderboard;

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
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        SupabaseAuthClient authClient,
        ILeaderboardRepository leaderboardRepository,
        IPremiumRepository premiumRepository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        try
        {
            var user = await GetAuthenticatedUserAsync(httpRequest, authClient, cancellationToken);

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

    private static async Task<VerifiedSupabaseUser?> GetAuthenticatedUserAsync(
        HttpRequest request,
        SupabaseAuthClient authClient,
        CancellationToken cancellationToken)
    {
        var accessToken = ReadBearerToken(request);

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        return await authClient.GetUserAsync(accessToken, cancellationToken);
    }

    private static string? ReadBearerToken(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Authorization", out var authorizationHeaderValues))
        {
            return null;
        }

        var authorizationHeader = authorizationHeaderValues.ToString();

        if (!authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return authorizationHeader["Bearer ".Length..].Trim();
    }
}
