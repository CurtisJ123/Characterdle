using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Leaderboard;

public interface ILeaderboardRepository
{
    Task<bool> GameExistsAsync(
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken);

    Task<UniverseLeaderboardResponse> GetLeaderboardAsync(
        UniverseDefinition universe,
        Guid? currentUserId,
        int limit,
        CancellationToken cancellationToken);

    Task EnsurePlayerProfileAsync(
        VerifiedSupabaseUser user,
        CancellationToken cancellationToken);

    Task<UniverseStreakResponse> UpsertUniverseGameResultAsync(
        Guid userId,
        UniverseDefinition universe,
        long gameId,
        int guessCount,
        int hintCount,
        string mode,
        string status,
        IReadOnlyList<long> guessedCharacterIds,
        IReadOnlyList<string> revealedHintKeys,
        CancellationToken cancellationToken);
}
