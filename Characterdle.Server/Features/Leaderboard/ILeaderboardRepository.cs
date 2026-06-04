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

    Task UpsertPlayerProfileAsync(
        VerifiedSupabaseUser user,
        CancellationToken cancellationToken);

    Task UpsertUniverseGameResultAsync(
        Guid userId,
        string universeId,
        long gameId,
        int guessCount,
        int hintCount,
        string mode,
        string status,
        CancellationToken cancellationToken);
}
