namespace Characterdle.Server.Features.Billing;

public sealed record StripePremiumStatusSnapshot(
    string? StripeCustomerId,
    string? StripeSubscriptionId,
    string Status,
    bool IsPremium,
    DateTimeOffset? CurrentPeriodStart,
    DateTimeOffset? CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    DateTimeOffset? PremiumStartedAt,
    DateTimeOffset? PremiumEndedAt);
