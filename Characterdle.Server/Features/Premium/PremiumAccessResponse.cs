namespace Characterdle.Server.Features.Premium;

public sealed record PremiumAccessResponse(
    bool IsPremium,
    string? PlanCode,
    string? SubscriptionStatus,
    int? BilledPriceCents,
    string? CurrencyCode,
    DateTimeOffset? CurrentPeriodStart,
    DateTimeOffset? CurrentPeriodEnd,
    bool CancelAtPeriodEnd,
    string? BillingDiscountCode,
    bool AdFree,
    bool PracticeMode,
    bool ProfileCustomization,
    bool SupporterBadge,
    bool FullArchiveAccess,
    int ArchiveLookbackDays,
    bool StreakProtection,
    int StreakSaversPerCycle,
    int AvailableStreakSavers,
    bool AutoUseStreakSavers);
