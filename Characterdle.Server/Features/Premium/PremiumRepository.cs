using Npgsql;

namespace Characterdle.Server.Features.Premium;

public sealed class PremiumRepository(
    NpgsqlDataSource dataSource,
    IPremiumStreakSaverService streakSaverService) : IPremiumRepository
{
    private const int DefaultArchiveLookbackDays = 3;
    private const string PremiumPlanCode = "premium";

    public async Task<PremiumStateResponse> GetPremiumStateAsync(
        Guid userId,
        CancellationToken cancellationToken)
        => new(await GetPremiumAccessAsync(userId, cancellationToken));

    public async Task<PremiumAccessResponse> GetPremiumAccessAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        await streakSaverService.EnsureMonthlyStreakSaversAsync(userId, cancellationToken);

        const string sql =
            """
            select
              is_premium,
              status,
              stripe_customer_id,
              stripe_subscription_id,
              current_period_start,
              current_period_end,
              cancel_at_period_end,
              premium_started_at,
              premium_ended_at,
              available_streak_savers,
              auto_use_streak_savers
            from public."UserPremiumStatus"
            where user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return CreateDefaultPremiumAccess();
        }

        var isPremium = !reader.IsDBNull(0) && reader.GetBoolean(0);
        var status = reader.IsDBNull(1) ? null : reader.GetString(1);
        var currentPeriodStart = reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(4);
        var currentPeriodEnd = reader.IsDBNull(5) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(5);
        var cancelAtPeriodEnd = !reader.IsDBNull(6) && reader.GetBoolean(6);
        var premiumEndedAt = reader.IsDBNull(8) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(8);
        var hasPremiumAccess = PremiumStatusEvaluator.HasPremiumAccess(
            isPremium,
            status,
            cancelAtPeriodEnd,
            currentPeriodEnd,
            premiumEndedAt,
            DateTimeOffset.UtcNow);

        return new PremiumAccessResponse(
            IsPremium: hasPremiumAccess,
            PlanCode: hasPremiumAccess ? PremiumPlanCode : null,
            SubscriptionStatus: status,
            BilledPriceCents: null,
            CurrencyCode: "USD",
            CurrentPeriodStart: currentPeriodStart,
            CurrentPeriodEnd: currentPeriodEnd,
            CancelAtPeriodEnd: cancelAtPeriodEnd,
            BillingDiscountCode: null,
            AdFree: hasPremiumAccess,
            PracticeMode: hasPremiumAccess,
            ProfileCustomization: hasPremiumAccess,
            SupporterBadge: hasPremiumAccess,
            FullArchiveAccess: hasPremiumAccess,
            ArchiveLookbackDays: hasPremiumAccess ? 36500 : DefaultArchiveLookbackDays,
            StreakProtection: hasPremiumAccess,
            StreakSaversPerCycle: hasPremiumAccess ? 1 : 0,
            AvailableStreakSavers: reader.IsDBNull(9) ? 0 : reader.GetInt32(9),
            AutoUseStreakSavers: reader.IsDBNull(10) || reader.GetBoolean(10));
    }

    public async Task<bool> HasActiveSubscriptionAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              premium_status.is_premium,
              premium_status.status,
              premium_status.cancel_at_period_end,
              premium_status.current_period_end,
              premium_status.premium_ended_at
            from public."UserPremiumStatus" as premium_status
            where premium_status.user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return false;
        }

        return PremiumStatusEvaluator.HasPremiumAccess(
            !reader.IsDBNull(0) && reader.GetBoolean(0),
            reader.IsDBNull(1) ? null : reader.GetString(1),
            !reader.IsDBNull(2) && reader.GetBoolean(2),
            reader.IsDBNull(3) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(3),
            reader.IsDBNull(4) ? (DateTimeOffset?)null : reader.GetFieldValue<DateTimeOffset>(4),
            DateTimeOffset.UtcNow);
    }
    private static PremiumAccessResponse CreateDefaultPremiumAccess() =>
        new(
            IsPremium: false,
            PlanCode: null,
            SubscriptionStatus: null,
            BilledPriceCents: null,
            CurrencyCode: null,
            CurrentPeriodStart: null,
            CurrentPeriodEnd: null,
            CancelAtPeriodEnd: false,
            BillingDiscountCode: null,
            AdFree: false,
            PracticeMode: false,
            ProfileCustomization: false,
            SupporterBadge: false,
            FullArchiveAccess: false,
            ArchiveLookbackDays: DefaultArchiveLookbackDays,
            StreakProtection: false,
            StreakSaversPerCycle: 0,
            AvailableStreakSavers: 0,
            AutoUseStreakSavers: true);
}
