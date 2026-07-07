using Characterdle.Server.Features.UniverseGames;

namespace Characterdle.Server.Features.Premium;

public interface IPremiumStreakSaverService
{
    Task EnsureMonthlyStreakSaversAsync(
        CancellationToken cancellationToken);

    Task EnsureMonthlyStreakSaversAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<int> ProtectMissedStreaksAsync(
        UniverseDefinition universe,
        DateOnly todayLocalDate,
        CancellationToken cancellationToken);
}
