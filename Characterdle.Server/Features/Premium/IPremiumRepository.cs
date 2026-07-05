namespace Characterdle.Server.Features.Premium;

public interface IPremiumRepository
{
    Task<PremiumStateResponse> GetPremiumStateAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<PremiumAccessResponse> GetPremiumAccessAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<bool> HasActiveSubscriptionAsync(
        Guid userId,
        CancellationToken cancellationToken);
}
