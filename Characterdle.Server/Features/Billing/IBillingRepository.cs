namespace Characterdle.Server.Features.Billing;

public interface IBillingRepository
{
    Task<string?> GetStripeCustomerIdAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<Guid?> GetUserIdByStripeCustomerIdAsync(
        string stripeCustomerId,
        CancellationToken cancellationToken);

    Task<bool> HasStartedPremiumAsync(
        Guid userId,
        CancellationToken cancellationToken);

    Task<bool> HasProcessedWebhookEventAsync(
        string eventId,
        CancellationToken cancellationToken);

    Task UpsertStripeCustomerIdAsync(
        Guid userId,
        string stripeCustomerId,
        CancellationToken cancellationToken);

    Task UpsertPremiumStatusAsync(
        Guid userId,
        StripePremiumStatusSnapshot snapshot,
        CancellationToken cancellationToken);

    Task RecordProcessedWebhookEventAsync(
        string eventId,
        string eventType,
        CancellationToken cancellationToken);
}
