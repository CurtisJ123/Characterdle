namespace Characterdle.Server.Features.Premium;

public static class PremiumStatusEvaluator
{
    public static bool HasPremiumAccess(
        bool isPremiumFlag,
        string? status,
        bool cancelAtPeriodEnd,
        DateTimeOffset? currentPeriodEnd,
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
            "canceled" => cancelAtPeriodEnd
                && currentPeriodEnd.HasValue
                && currentPeriodEnd.Value > nowUtc,
            _ => false,
        };
    }

    private static string NormalizeStatus(string? status) =>
        string.IsNullOrWhiteSpace(status)
            ? string.Empty
            : status.Trim().ToLowerInvariant();
}
