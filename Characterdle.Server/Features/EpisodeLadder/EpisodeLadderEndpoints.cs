using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Infrastructure.Auth;

namespace Characterdle.Server.Features.EpisodeLadder;

public static class EpisodeLadderEndpoints
{
    public static IEndpointRouteBuilder MapEpisodeLadderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/universes/{universeId}/episode-ladder")
            .WithTags("Episode Ladder")
            .AddEndpointFilter(async (context, next) =>
            {
                context.HttpContext.Response.Headers.CacheControl = "private, no-store";
                context.HttpContext.Response.Headers.Vary = "Authorization";
                return await next(context);
            });
        group.MapGet("/current", GetAsync);
        group.MapGet("/{gameId:long}", GetAsync);
        group.MapPost("/{gameId:long}/attempts", SubmitAsync);
        group.MapPost("/{gameId:long}/import", ImportAsync);
        group.MapGet("/random", GetRandomAsync);
        group.MapPost("/random/attempts", SubmitRandomAsync);
        return app;
    }

    private static Task<IResult> GetRandomAsync(string universeId, int? difficulty, ICurrentSupabaseUserAccessor userAccessor,
        IPremiumRepository premiumRepository, IEpisodeLadderRepository repository, RandomLadderSession sessions,
        ILoggerFactory loggerFactory, CancellationToken cancellationToken) =>
        RunRandomAsync(universeId, null, difficulty ?? 1, userAccessor, premiumRepository, repository, sessions, loggerFactory, cancellationToken);

    private static Task<IResult> SubmitRandomAsync(string universeId, SubmitRandomLadderRequest request,
        ICurrentSupabaseUserAccessor userAccessor, IPremiumRepository premiumRepository,
        IEpisodeLadderRepository repository, RandomLadderSession sessions, ILoggerFactory loggerFactory,
        CancellationToken cancellationToken) =>
        RunRandomAsync(universeId, request, 1, userAccessor, premiumRepository, repository, sessions, loggerFactory, cancellationToken);

    private static async Task<IResult> RunRandomAsync(string universeId, SubmitRandomLadderRequest? request, int difficulty,
        ICurrentSupabaseUserAccessor userAccessor, IPremiumRepository premiumRepository,
        IEpisodeLadderRepository repository, RandomLadderSession sessions, ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (universeId != "got") return Results.NotFound();
        if (difficulty is < 1 or > 5) return Results.BadRequest(new { message = "Choose a difficulty from 1 to 5." });
        try
        {
            var user = await userAccessor.GetCurrentUserAsync(cancellationToken);
            if (user is null) return Results.Unauthorized();
            var premium = await premiumRepository.GetPremiumAccessAsync(user.UserId, cancellationToken);
            if (!premium.PracticeMode)
                return Results.Json(new { message = "Premium unlocks random Episode Ladder games." }, statusCode: 403);
            if (request is not null)
                return Results.Ok(sessions.Submit(request.RoundToken, request.Order, user.UserId));

            var catalog = await repository.GetEventCatalogAsync(cancellationToken);
            var puzzle = EpisodeLadderRules.GenerateRandom(catalog, difficulty);
            return puzzle is null
                ? Results.Json(new { message = "Not enough events from distinct episodes to match this difficulty's spacing." }, statusCode: 503)
                : Results.Ok(sessions.Start(puzzle, user.UserId));
        }
        catch (LadderValidationException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            loggerFactory.CreateLogger(typeof(EpisodeLadderEndpoints).FullName!).LogError(exception, "Random Episode Ladder request failed.");
            return Results.Problem(title: "Random Episode Ladder is temporarily unavailable.", statusCode: 503);
        }
    }

    private static Task<IResult> GetAsync(string universeId, long? gameId, int? difficulty, HttpContext context,
        ICurrentSupabaseUserAccessor userAccessor, IPremiumRepository premiumRepository,
        IEpisodeLadderRepository repository, ILoggerFactory loggerFactory, CancellationToken cancellationToken) =>
        RunAsync(universeId, gameId, difficulty ?? 1, null, false, context, userAccessor, premiumRepository, repository,
            null, loggerFactory, cancellationToken);

    private static Task<IResult> SubmitAsync(string universeId, long gameId, SubmitLadderRequest request, HttpContext context,
        ICurrentSupabaseUserAccessor userAccessor, IPremiumRepository premiumRepository,
        IEpisodeLadderRepository repository, ILeaderboardRepository profiles, ILoggerFactory loggerFactory,
        CancellationToken cancellationToken) => RunAsync(universeId, gameId, request.Difficulty, request, false, context,
            userAccessor, premiumRepository, repository, profiles, loggerFactory, cancellationToken);

    private static Task<IResult> ImportAsync(string universeId, long gameId, SubmitLadderRequest request, HttpContext context,
        ICurrentSupabaseUserAccessor userAccessor, IPremiumRepository premiumRepository,
        IEpisodeLadderRepository repository, ILeaderboardRepository profiles, ILoggerFactory loggerFactory,
        CancellationToken cancellationToken) => RunAsync(universeId, gameId, request.Difficulty, request, true, context,
            userAccessor, premiumRepository, repository, profiles, loggerFactory, cancellationToken);

    private static async Task<IResult> RunAsync(string universeId, long? gameId, int difficulty, SubmitLadderRequest? request,
        bool importGuest, HttpContext context, ICurrentSupabaseUserAccessor userAccessor,
        IPremiumRepository premiumRepository, IEpisodeLadderRepository repository, ILeaderboardRepository? profiles,
        ILoggerFactory loggerFactory, CancellationToken cancellationToken)
    {
        if (universeId != "got" || gameId is <= 0) return Results.NotFound();
        if (difficulty is < 1 or > 5) return Results.BadRequest(new { message = "Choose a difficulty from 1 to 5." });
        try
        {
            var user = await userAccessor.GetCurrentUserAsync(cancellationToken);
            if (user is null && (importGuest || context.Request.Headers.ContainsKey("Authorization")))
                return Results.Unauthorized();
            if (request is not null && (request.Attempts is null || request.Attempts.Length > 4
                || request.Attempts.Any(order => order is null || order.Length != 5)
                || (user is null && (request.GuestId is null || request.GuestId == Guid.Empty))))
                return Results.BadRequest(new { message = "Invalid Episode Ladder submission." });

            var game = await repository.GetGameReferenceAsync(gameId, cancellationToken);
            if (game is null) return Results.NotFound(new { message = "This daily game is not available." });
            if (game.ArchiveIndex > 3)
            {
                var premium = user is null ? null : await premiumRepository.GetPremiumAccessAsync(user.UserId, cancellationToken);
                if (premium?.FullArchiveAccess != true)
                    return Results.Json(new { message = "Premium unlocks the full Episode Ladder archive." }, statusCode: 403);
            }
            var puzzle = await repository.GetPuzzleAsync(game, cancellationToken, difficulty);
            if (puzzle is null)
                return Results.Json(new { message = "Not enough episode coverage to prepare all five daily difficulties." }, statusCode: 503);

            if (request is null)
            {
                var saved = user is null ? [] : await repository.GetAttemptsAsync(user.UserId, game.Id, cancellationToken, difficulty);
                return Results.Ok(EpisodeLadderRules.Replay(puzzle, saved) with { Difficulties = user is null ? null
                    : await repository.GetDifficultyStatesAsync(user.UserId, game.Id, cancellationToken) });
            }
            var replay = EpisodeLadderRules.Replay(puzzle, request.Attempts!);
            if (importGuest && replay.Status != "won")
                throw new LadderValidationException("Only completed guest victories can be imported.");
            if (user is not null)
                await profiles!.EnsurePlayerProfileAsync(user, cancellationToken);
            return Results.Ok(await repository.SubmitAsync(puzzle, user?.UserId, request.GuestId,
                request.Attempts!, importGuest, cancellationToken));
        }
        catch (LadderConflictException exception)
        {
            return Results.Json(new { message = exception.Message, current = exception.Current }, statusCode: 409);
        }
        catch (LadderValidationException exception)
        {
            return Results.BadRequest(new { message = exception.Message });
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            loggerFactory.CreateLogger(typeof(EpisodeLadderEndpoints).FullName!).LogError(exception, "Episode Ladder request failed.");
            return Results.Problem(title: "Episode Ladder is temporarily unavailable.", statusCode: 503);
        }
    }
}
