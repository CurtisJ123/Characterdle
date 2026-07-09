namespace Characterdle.Server.Features.Billing;

public sealed record StripePremiumStatusSnapshot(
    string? StripeCustomerId,
    string? StripeSubscriptionId,
    string Status,
    bool IsPremium,
    DateTimeOffset? CurrentPeriodStart,
    DateTimeOffset? CurrentPeriodEnd,
    DateTimeOffset? CancelAt,
    bool CancelAtPeriodEnd,
    DateTimeOffset? PremiumStartedAt,
    DateTimeOffset? PremiumEndedAt);
