namespace Characterdle.Server.Features.Premium;

public static class PremiumStatusEvaluator
{
    public static bool HasPremiumAccess(
        bool isPremiumFlag,
        string? status,
        bool cancelAtPeriodEnd,
        DateTimeOffset? currentPeriodEnd,
        DateTimeOffset? cancelAt,
        DateTimeOffset? premiumEndedAt,
        DateTimeOffset nowUtc)
    {
        if (premiumEndedAt.HasValue && premiumEndedAt.Value <= nowUtc)
        {
            return false;
        }

        if (isPremiumFlag)
        {
            return true;
        }

        return NormalizeStatus(status) switch
        {
            "active" => true,
            "trialing" => true,
            "past_due" => true,
            "canceled" => ResolveScheduledCancellationAt(cancelAtPeriodEnd, currentPeriodEnd, cancelAt) is { } scheduledCancellationAt
                && scheduledCancellationAt > nowUtc,
            _ => false,
        };
    }

    public static DateTimeOffset? ResolveScheduledCancellationAt(
        bool cancelAtPeriodEnd,
        DateTimeOffset? currentPeriodEnd,
        DateTimeOffset? cancelAt)
    {
        if (cancelAt.HasValue)
        {
            return cancelAt.Value;
        }

        return cancelAtPeriodEnd
            ? currentPeriodEnd
            : null;
    }

    private static string NormalizeStatus(string? status) =>
        string.IsNullOrWhiteSpace(status)
            ? string.Empty
            : status.Trim().ToLowerInvariant();
}
