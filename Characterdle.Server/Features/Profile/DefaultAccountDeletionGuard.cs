namespace Characterdle.Server.Features.Profile;

public sealed class DefaultAccountDeletionGuard : IAccountDeletionGuard
{
    private static readonly AccountDeletionEligibility EligibleResponse = new(
        true,
        false,
        "Deleting your account permanently removes your profile, streaks, and leaderboard history.");

    public Task<AccountDeletionEligibility> GetEligibilityAsync(
        Guid userId,
        CancellationToken cancellationToken) =>
        Task.FromResult(EligibleResponse);
}
