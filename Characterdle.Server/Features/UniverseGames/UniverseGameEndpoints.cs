namespace Characterdle.Server.Features.UniverseGames;

public static class UniverseGameEndpoints
{
    public static IEndpointRouteBuilder MapUniverseGameEndpoints(this IEndpointRouteBuilder app)
    {
        var games = app.MapGroup("/api/universes/{universeId}/games").WithTags("UniverseGames");

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

        return app;
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
}
