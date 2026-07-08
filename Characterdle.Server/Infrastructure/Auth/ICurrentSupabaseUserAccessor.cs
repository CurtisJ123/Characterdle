using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Infrastructure.Auth;

public interface ICurrentSupabaseUserAccessor
{
    Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken cancellationToken);
}
