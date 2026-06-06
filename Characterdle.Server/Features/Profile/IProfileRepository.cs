using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Profile;

public interface IProfileRepository
{
    Task<UserUniverseProfileResponse?> GetProfileAsync(
        UniverseDefinition universe,
        Guid userId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<ProfileRecentResultResponse>> GetGameResultsAsync(
        string universeId,
        Guid userId,
        CancellationToken cancellationToken);

    Task UpdateDisplayNameAsync(
        Guid userId,
        string email,
        string displayName,
        CancellationToken cancellationToken);
}
