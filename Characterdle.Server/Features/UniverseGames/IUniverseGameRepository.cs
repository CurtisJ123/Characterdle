namespace Characterdle.Server.Features.UniverseGames;

public interface IUniverseGameRepository
{
    Task<CurrentUniverseGameResponse?> GetCurrentGameAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken);

    Task<CurrentUniverseGameResponse?> GetGameByIdAsync(
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken);

    Task<PreviousUniverseGamesResponse> GetPreviousGamesAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken);

    Task<DateTime?> GetMostRecentGameDateTimeUtcAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken);

    Task<ScheduledUniverseGameCreationResult> CreateScheduledGameAsync(
        UniverseDefinition universe,
        DateTime scheduledAtUtc,
        string selectionSeed,
        CancellationToken cancellationToken);
}
