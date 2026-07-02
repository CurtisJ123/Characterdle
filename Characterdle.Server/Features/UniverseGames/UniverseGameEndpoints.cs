namespace Characterdle.Server.Features.UniverseGames;

public static class UniverseGameEndpoints
{
    public static IEndpointRouteBuilder MapUniverseGameEndpoints(this IEndpointRouteBuilder app)
    {
        var games = app.MapGroup("/api/universes/{universeId}/games").WithTags("UniverseGames");

        games.MapGet("/characters", GetCharactersAsync)
            .WithName("GetUniverseCharacterAvatarOptions")
            .Produces<IReadOnlyList<UniverseCharacterAvatarOptionResponse>>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        games.MapGet("/current", GetCurrentGameAsync)
            .WithName("GetCurrentUniverseGame")
            .Produces<CurrentUniverseGameResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        games.MapGet("/{gameId:long}", GetGameByIdAsync)
            .WithName("GetUniverseGameById")
            .Produces<CurrentUniverseGameResponse>()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        games.MapGet("/previous", GetPreviousGamesAsync)
            .WithName("GetPreviousUniverseGames")
            .Produces<PreviousUniverseGamesResponse>()
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        games.MapPost("/{gameId:long}/plays", TrackGamePlayAsync)
            .WithName("TrackUniverseGamePlay")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesValidationProblem()
            .Produces(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status503ServiceUnavailable);

        return app;
    }

    private static async Task<IResult> GetCharactersAsync(
        string universeId,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        IUniverseGameRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var characters = await repository.GetCharacterAvatarOptionsAsync(universe, cancellationToken);
            return Results.Ok(characters);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(UniverseGameEndpoints).FullName!);
            logger.LogError(exception, "Unable to load universe character avatar options from Supabase for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading avatar options.";

            return Results.Problem(
                title: "Unable to load universe character avatar options.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetCurrentGameAsync(
        string universeId,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        IUniverseGameRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var game = await repository.GetCurrentGameAsync(universe, cancellationToken);

            return game is null
                ? Results.NotFound(new { message = $"No game data was found for universe '{universe.DisplayName}'." })
                : Results.Ok(game);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(UniverseGameEndpoints).FullName!);
            logger.LogError(exception, "Unable to load universe game data from Supabase for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading game data.";

            return Results.Problem(
                title: "Unable to load universe game data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetPreviousGamesAsync(
        string universeId,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        IUniverseGameRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var previousGames = await repository.GetPreviousGamesAsync(universe, cancellationToken);
            return Results.Ok(previousGames);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(UniverseGameEndpoints).FullName!);
            logger.LogError(exception, "Unable to load previous universe game data from Supabase for {UniverseId}.", universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading previous game data.";

            return Results.Problem(
                title: "Unable to load previous universe game data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> GetGameByIdAsync(
        string universeId,
        long gameId,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        IUniverseGameRepository repository,
        ILoggerFactory loggerFactory,
        CancellationToken cancellationToken)
    {
        if (!universeCatalog.TryGet(universeId, out var universe))
        {
            return Results.NotFound(new { message = $"No universe named '{universeId}' is registered." });
        }

        try
        {
            var game = await repository.GetGameByIdAsync(universe, gameId, cancellationToken);

            return game is null
                ? Results.NotFound(new { message = $"No archived game '{gameId}' was found for universe '{universe.DisplayName}'." })
                : Results.Ok(game);
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(UniverseGameEndpoints).FullName!);
            logger.LogError(exception, "Unable to load archived universe game {GameId} from Supabase for {UniverseId}.", gameId, universeId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while loading the archived game.";

            return Results.Problem(
                title: "Unable to load archived universe game.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static async Task<IResult> TrackGamePlayAsync(
        string universeId,
        long gameId,
        SubmitUniverseGamePlayRequest request,
        IHostEnvironment hostEnvironment,
        UniverseCatalog universeCatalog,
        IUniverseGameRepository repository,
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

            if (gameId <= 0)
            {
                validationErrors["gameId"] = ["Game id must be a positive integer."];
            }

            if (validationErrors.Count > 0)
            {
                return Results.ValidationProblem(validationErrors);
            }

            var wasTracked = await repository.UpsertGamePlayAsync(
                universe,
                gameId,
                request.Mode.Trim().ToLowerInvariant(),
                request.ParticipantKey.Trim(),
                request.GuessCount,
                request.HintCount,
                request.Status.Trim().ToLowerInvariant(),
                cancellationToken);

            return wasTracked
                ? Results.NoContent()
                : Results.NotFound(new { message = $"No game '{gameId}' exists for universe '{universe.DisplayName}'." });
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            var logger = loggerFactory.CreateLogger(typeof(UniverseGameEndpoints).FullName!);
            logger.LogError(exception, "Unable to track game play for {UniverseId} game {GameId}.", universeId, gameId);

            var detail = hostEnvironment.IsDevelopment()
                ? exception.GetBaseException().Message
                : "The database request failed while saving game play data.";

            return Results.Problem(
                title: "Unable to save game play data.",
                detail: detail,
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }

    private static Dictionary<string, string[]> Validate(SubmitUniverseGamePlayRequest request)
    {
        var errors = new Dictionary<string, string[]>();

        if (string.IsNullOrWhiteSpace(request.ParticipantKey))
        {
            errors["participantKey"] = ["Participant key is required."];
        }
        else if (request.ParticipantKey.Trim().Length > 128)
        {
            errors["participantKey"] = ["Participant key is too long."];
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

        return errors;
    }
}
