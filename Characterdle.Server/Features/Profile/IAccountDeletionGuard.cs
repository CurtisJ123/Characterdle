namespace Characterdle.Server.Features.Profile;

public interface IAccountDeletionGuard
{
    Task<AccountDeletionEligibility> GetEligibilityAsync(
        Guid userId,
        CancellationToken cancellationToken);
}
