using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.GameComments;

public interface IGameCommentRepository
{
    // Null means the caller has no completed result for this scheduled game and mode.
    Task<GameCommentsPageResponse?> GetPageAsync(
        Guid userId, UniverseDefinition universe, long gameId, string mode, int page,
        CancellationToken cancellationToken);

    Task<GameCommentResponse?> CreateAsync(
        Guid userId, UniverseDefinition universe, long gameId, string mode, string body,
        CancellationToken cancellationToken);
}
