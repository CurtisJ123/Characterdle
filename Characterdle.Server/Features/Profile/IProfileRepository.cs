using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Profile;

public interface IProfileRepository
{
    Task<UserUniverseProfileResponse?> GetProfileAsync(
        UniverseDefinition universe,
        Guid userId,
        CancellationToken cancellationToken);
}
