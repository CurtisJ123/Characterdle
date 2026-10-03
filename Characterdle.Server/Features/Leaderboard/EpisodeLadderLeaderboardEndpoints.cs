using Characterdle.Server.Infrastructure.Auth;

namespace Characterdle.Server.Features.Leaderboard;

public static class EpisodeLadderLeaderboardEndpoints
{
    public static IEndpointRouteBuilder MapEpisodeLadderLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/universes/{universeId}/leaderboard/episode-ladder", GetAsync)
            .WithTags("Leaderboard")
            .Produces<EpisodeLadderLeaderboardResponse>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);
        return app;
    }

    private static async Task<IResult> GetAsync(string universeId, HttpContext context,
        ICurrentSupabaseUserAccessor userAccessor, IEpisodeLadderLeaderboardRepository repository,
        ILeaderboardViewerResolver viewerResolver,
        ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        LeaderboardVisibility.Headers(context);
        if (universeId != "got") return Results.NotFound();
        try
        {
            var user = await userAccessor.GetCurrentUserAsync(cancellationToken);
            if (user is null && context.Request.Headers.ContainsKey("Authorization")) return Results.Unauthorized();
            var viewer = await viewerResolver.ResolveAsync(user?.UserId, context.Request.Headers[LeaderboardVisibility.GuestHeader], cancellationToken);
            return Results.Ok(await repository.GetAsync(user?.UserId, 50, cancellationToken, viewer));
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            loggerFactory.CreateLogger(typeof(EpisodeLadderLeaderboardEndpoints).FullName!)
                .LogError(exception, "Unable to load Episode Ladder leaderboard.");
            return Results.Problem(title: "Episode Ladder leaderboard is temporarily unavailable.", statusCode: 503);
        }
    }
}
