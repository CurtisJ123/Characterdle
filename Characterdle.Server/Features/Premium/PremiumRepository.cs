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

        return new PremiumAccessResponse(
            IsPremium: isPremium,
            PlanCode: isPremium ? PremiumPlanCode : null,
            SubscriptionStatus: status,
            BilledPriceCents: null,
            CurrencyCode: "USD",
            CurrentPeriodStart: reader.IsDBNull(4) ? null : reader.GetFieldValue<DateTimeOffset>(4),
            CurrentPeriodEnd: reader.IsDBNull(5) ? null : reader.GetFieldValue<DateTimeOffset>(5),
            CancelAtPeriodEnd: !reader.IsDBNull(6) && reader.GetBoolean(6),
            BillingDiscountCode: null,
            AdFree: isPremium,
            PracticeMode: isPremium,
            ProfileCustomization: isPremium,
            SupporterBadge: isPremium,
            FullArchiveAccess: isPremium,
            ArchiveLookbackDays: isPremium ? 36500 : DefaultArchiveLookbackDays,
            StreakProtection: isPremium,
            StreakSaversPerCycle: isPremium ? 1 : 0,
            AvailableStreakSavers: reader.IsDBNull(9) ? 0 : reader.GetInt32(9),
            AutoUseStreakSavers: reader.IsDBNull(10) || reader.GetBoolean(10));
    }

    public async Task<bool> HasActiveSubscriptionAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select exists(
              select 1
              from public."UserPremiumStatus" as premium_status
              where premium_status.user_id = @userId
                and (
                  premium_status.is_premium = true
                  or premium_status.status in ('active', 'trialing', 'past_due')
                  or (
                    premium_status.status = 'canceled'
                    and premium_status.current_period_end > timezone('utc', now())
                  )
                )
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);

        return await command.ExecuteScalarAsync(cancellationToken) is true;
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
