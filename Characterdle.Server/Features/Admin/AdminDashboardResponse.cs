using Characterdle.Server.Features.Premium;

namespace Characterdle.Server.Features.Admin;

public sealed record AdminDashboardResponse(
    DateTimeOffset GeneratedAt,
    DateTimeOffset ActivitySince,
    long Profiles,
    long NewProfiles,
    long AccountsWithCompletedGames,
    AdminPremiumCounts Premium,
    AdminPlayerCounts Players);

public sealed record AdminPlayerCounts(long UniquePlayers, long ActivePlayers, long StartedGames, long CompletedGames);

public sealed record AdminPremiumCounts(long Users = 0, long TrialUsers = 0, long ActiveSubscriptions = 0, long PastDueSubscriptions = 0)
{
    public AdminPremiumCounts AddGroup(
        long count, bool isPremium, string? status, bool cancelAtPeriodEnd,
        DateTimeOffset? currentPeriodEnd, DateTimeOffset? cancelAt, DateTimeOffset? premiumEndedAt,
        bool hasSubscription, DateTimeOffset now)
    {
        var hasAccess = PremiumStatusEvaluator.HasPremiumAccess(
            isPremium, status, cancelAtPeriodEnd, currentPeriodEnd, cancelAt, premiumEndedAt, now);
        var normalizedStatus = status?.Trim().ToLowerInvariant();
        return new(
            Users + (hasAccess ? count : 0),
            TrialUsers + (hasAccess && normalizedStatus == "trialing" ? count : 0),
            ActiveSubscriptions + (hasAccess && hasSubscription && normalizedStatus == "active" ? count : 0),
            PastDueSubscriptions + (hasSubscription && normalizedStatus == "past_due" ? count : 0));
    }
}

public interface IAdminDashboardRepository
{
    Task<AdminDashboardResponse> GetAsync(CancellationToken cancellationToken);
}
