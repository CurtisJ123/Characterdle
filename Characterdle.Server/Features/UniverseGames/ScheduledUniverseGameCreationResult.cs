namespace Characterdle.Server.Features.UniverseGames;

public sealed record ScheduledUniverseGameCreationResult(
    bool Created,
    bool AlreadyExists,
    bool HasCharacters,
    long? GameId);
