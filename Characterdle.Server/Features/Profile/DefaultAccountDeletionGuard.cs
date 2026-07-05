namespace Characterdle.Server.Features.Profile;

using Characterdle.Server.Features.Premium;

public sealed class DefaultAccountDeletionGuard(IPremiumRepository premiumRepository) : IAccountDeletionGuard
{
    public async Task<AccountDeletionEligibility> GetEligibilityAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (await premiumRepository.HasActiveSubscriptionAsync(userId, cancellationToken))
        {
            return new AccountDeletionEligibility(
                false,
                true,
                "Cancel your premium subscription and wait for it to end before deleting this account.");
        }

        return new AccountDeletionEligibility(
            true,
            false,
            "Deleting your account permanently removes your profile, streaks, and leaderboard history.");
    }
}
