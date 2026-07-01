using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Leaderboard;

public static class LeaderboardEndpoints
{
    public static IEndpointRouteBuilder MapLeaderboardEndpoints(this IEndpointRouteBuilder app)
    {
        var leaderboard = app.MapGroup("/api/universes/{universeId}/leaderboard").WithTags("Leaderboard");

        leaderboard.MapGet("/", GetLeaderboardAsync)
            .WithName("GetUniverseLeaderboard")
            .Produces<UniverseLeaderboardResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        leaderboard.MapPost("/results", SubmitResultAsync)
            .WithName("SubmitUniverseLeaderboardResult")
            .Produces<UniverseStreakResponse>()
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    private static async Task<IResult> GetLeaderboardAsync(
        string universeId,
        string? currentUserId,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        ILeaderboardRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            Guid? parsedCurrentUserId = null;

            if (!string.IsNullOrWhiteSpace(currentUserId) && Guid.TryParse(currentUserId, out var currentUserGuid))
            {
                parsedCurrentUserId = currentUserGuid;
            }

            var leaderboard = await repository.GetLeaderboardAsync(
                universe,
                parsedCurrentUserId,
                limit: 50,
                cancellationToken);

            return Results.Ok(leaderboard);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(LeaderboardEndpoints).FullName!);
            logger.LogError(exception, "Unable to load leaderboard data for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading leaderboard data.";

            return Results.Problem(
                title: "Unable to load leaderboard data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> SubmitResultAsync(
        string universeId,
        SubmitUniverseGameResultRequest request,
        HttpRequest httpRequest,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        ILeaderboardRepository repository,
        SupabaseAuthClient authClient,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var validationErrors = Validate(request);

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var accessToken = ReadBearerToken(httpRequest);

            if (string.IsNullOrWhiteSpace(accessToken))
            {
                return Results.Unauthorized();
            }

            var user = await authClient.GetUserAsync(accessToken, cancellationToken);

            if (user is null)
            {
                return Results.Unauthorized();
            }

            if (!await repository.GameExistsAsync(universe, request.GameId, cancellationToken))
            {
                return Results.NotFound(new { message = $"No game '{request.GameId}' exists for universe '{universe.DisplayName}'." });
            }

            await repository.EnsurePlayerProfileAsync(user, cancellationToken);
            var streak = await repository.UpsertUniverseGameResultAsync(
                user.UserId,
                universe,
                request.GameId,
                request.GuessCount,
                request.HintCount,
                request.Mode.Trim().ToLowerInvariant(),
                request.Status.Trim().ToLowerInvariant(),
                request.GuessedCharacterIds,
                request.RevealedHintKeys,
                cancellationToken);

            return Results.Ok(streak);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(LeaderboardEndpoints).FullName!);
            logger.LogError(exception, "Unable to submit leaderboard result for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while saving leaderboard data.";

            return Results.Problem(
                title: "Unable to save leaderboard data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static Dictionary<string, string[]> Validate(SubmitUniverseGameResultRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (request.GameId <= 0)
        {
            errors["gameId"] = ["Game id must be a positive integer."];
        }

        if (request.GuessCount < 0)
        {
            errors["guessCount"] = ["Guess count cannot be negative."];
        }

        if (request.HintCount < 0)
        {
            errors["hintCount"] = ["Hint count cannot be negative."];
        }

        var normalizedMode = request.Mode?.Trim().ToLowerInvariant();

        if (normalizedMode is not "character" and not "quote")
        {
            errors["mode"] = ["Mode must be either 'character' or 'quote'."];
        }

        var normalizedStatus = request.Status?.Trim().ToLowerInvariant();

        if (normalizedStatus is not "playing" and not "won" and not "lost")
        {
            errors["status"] = ["Status must be 'playing', 'won', or 'lost'."];
        }

        if (request.GuessedCharacterIds is null)
        {
            errors["guessedCharacterIds"] = ["Guessed character ids are required."];
        }
        else if (request.GuessedCharacterIds.Count > 50)
        {
            errors["guessedCharacterIds"] = ["At most 50 guessed character ids can be stored."];
        }
        else if (
            request.GuessedCharacterIds.Any(static characterId => characterId <= 0)
            || request.GuessedCharacterIds.Distinct().Count() != request.GuessedCharacterIds.Count)
        {
            errors["guessedCharacterIds"] = ["Guessed character ids must be unique positive integers."];
        }
        else if (request.GuessCount < request.GuessedCharacterIds.Count)
        {
            errors["guessCount"] = ["Guess count cannot be less than the number of stored guesses."];
        }

        if (request.RevealedHintKeys is null)
        {
            errors["revealedHintKeys"] = ["Revealed hint keys are required."];
        }
        else if (request.RevealedHintKeys.Count > 50)
        {
            errors["revealedHintKeys"] = ["At most 50 revealed hint keys can be stored."];
        }
        else if (
            request.RevealedHintKeys.Any(static key => string.IsNullOrWhiteSpace(key) || key.Length > 100)
            || request.RevealedHintKeys.Distinct(StringComparer.Ordinal).Count() != request.RevealedHintKeys.Count)
        {
            errors["revealedHintKeys"] = ["Revealed hint keys must be unique non-empty values no longer than 100 characters."];
        }
        else if (request.HintCount != request.RevealedHintKeys.Count)
        {
            errors["hintCount"] = ["Hint count must match the number of revealed hint keys."];
        }

        return errors;
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
