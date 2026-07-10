using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Profile;

public interface IProfileRepository
{
    Task<UserUniverseProfileResponse?> GetProfileAsync(
        UniverseDefinition universe,
        Guid userId,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<UniverseGameResultResponse>> GetGameResultsAsync(
        string universeId,
        Guid userId,
        CancellationToken cancellationToken);

    Task<bool> IsAvatarUrlAvailableAsync(
        UniverseDefinition universe,
        string avatarUrl,
        CancellationToken cancellationToken);

    Task UpdateProfileAsync(
        Guid userId,
        string email,
        string displayName,
        string? avatarUrl,
        bool updateAvatar,
        bool autoUseStreakSavers,
        CancellationToken cancellationToken);

    Task DeleteAccountDataAsync(
        Guid userId,
        CancellationToken cancellationToken);
}
