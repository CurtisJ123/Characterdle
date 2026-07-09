using Characterdle.Server.Features.UniverseGames;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace Characterdle.Server.Features.Premium;

public sealed class PremiumStreakSaverService(
    NpgsqlDataSource dataSource,
    ILogger<PremiumStreakSaverService> logger) : IPremiumStreakSaverService
{
    public async Task EnsureMonthlyStreakSaversAsync(CancellationToken cancellationToken)
    {
        const string sql =
            """
            with eligible as (
              select
                premium_status.user_id,
                coalesce(premium_status.premium_started_at, premium_status.current_period_start) as billing_anchor_at,
                premium_status.last_streak_saver_cycle_start
              from public."UserPremiumStatus" as premium_status
              where (
                (
                  premium_status.is_premium = true
                  or premium_status.status in ('active', 'trialing', 'past_due')
                )
                and (
                  premium_status.premium_ended_at is null
                  or premium_status.premium_ended_at > now()
                )
                or (
                  premium_status.status = 'canceled'
                  and premium_status.cancel_at_period_end = true
                  and premium_status.current_period_end > now()
                  and (
                    premium_status.premium_ended_at is null
                    or premium_status.premium_ended_at > now()
                  )
                )
              )
                and coalesce(premium_status.premium_started_at, premium_status.current_period_start) is not null
            ),
            pending_awards as (
              select
                eligible.user_id,
                count(*)::int as saver_count,
                max(cycles.cycle_start) as latest_cycle_start
              from eligible
              cross join lateral generate_series(
                eligible.billing_anchor_at,
                now(),
                interval '1 month'
              ) as cycles(cycle_start)
              where cycles.cycle_start
                > coalesce(eligible.last_streak_saver_cycle_start, eligible.billing_anchor_at - interval '1 second')
              group by eligible.user_id
            )
            update public."UserPremiumStatus" as premium_status
            set
              available_streak_savers = premium_status.available_streak_savers + pending_awards.saver_count,
              last_streak_saver_cycle_start = pending_awards.latest_cycle_start,
              updated_at = timezone('utc', now())
            from pending_awards
            where premium_status.user_id = pending_awards.user_id
              and pending_awards.saver_count > 0;
            """;

        await using var command = dataSource.CreateCommand(sql);
        var awardedUserCount = await command.ExecuteNonQueryAsync(cancellationToken);

        if (awardedUserCount > 0)
        {
            logger.LogInformation(
                "Awarded pending monthly streak savers to {AwardedUserCount} premium account(s).",
                awardedUserCount);
        }
    }

    public async Task EnsureMonthlyStreakSaversAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with eligible as (
              select
                premium_status.user_id,
                coalesce(premium_status.premium_started_at, premium_status.current_period_start) as billing_anchor_at,
                premium_status.last_streak_saver_cycle_start
              from public."UserPremiumStatus" as premium_status
              where premium_status.user_id = @userId
                and (
                  (
                    premium_status.is_premium = true
                    or premium_status.status in ('active', 'trialing', 'past_due')
                  )
                  and (
                    premium_status.premium_ended_at is null
                    or premium_status.premium_ended_at > now()
                  )
                  or (
                    premium_status.status = 'canceled'
                    and premium_status.cancel_at_period_end = true
                    and premium_status.current_period_end > now()
                    and (
                      premium_status.premium_ended_at is null
                      or premium_status.premium_ended_at > now()
                    )
                  )
                )
                and coalesce(premium_status.premium_started_at, premium_status.current_period_start) is not null
            ),
            pending_awards as (
              select
                eligible.user_id,
                count(*)::int as saver_count,
                max(cycles.cycle_start) as latest_cycle_start
              from eligible
              cross join lateral generate_series(
                eligible.billing_anchor_at,
                now(),
                interval '1 month'
              ) as cycles(cycle_start)
              where cycles.cycle_start
                > coalesce(eligible.last_streak_saver_cycle_start, eligible.billing_anchor_at - interval '1 second')
              group by eligible.user_id
            )
            update public."UserPremiumStatus" as premium_status
            set
              available_streak_savers = premium_status.available_streak_savers + pending_awards.saver_count,
              last_streak_saver_cycle_start = pending_awards.latest_cycle_start,
              updated_at = timezone('utc', now())
            from pending_awards
            where premium_status.user_id = pending_awards.user_id
              and pending_awards.saver_count > 0;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<int> ProtectMissedStreaksAsync(
        UniverseDefinition universe,
        DateOnly todayLocalDate,
        CancellationToken cancellationToken)
    {
        var minimumActiveDate = todayLocalDate.AddDays(-1);
        var protectedThroughDate = todayLocalDate.AddDays(-1);
        var candidates = await LoadCandidatesAsync(
            universe,
            minimumActiveDate,
            cancellationToken);

        if (candidates.Count == 0)
        {
            return 0;
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var protectedUserCount = 0;

        foreach (var candidate in candidates)
        {
            var gapDays = protectedThroughDate.DayNumber - candidate.LastCreditDate.DayNumber;

            if (!candidate.AutoUseStreakSavers || gapDays <= 0 || candidate.AvailableStreakSavers < gapDays)
            {
                continue;
            }

            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
            var insertedUsageCount = 0;

            foreach (var protectedDate in EnumerateProtectedDates(candidate.LastCreditDate, protectedThroughDate))
            {
                insertedUsageCount += await InsertUsageAsync(
                    connection,
                    transaction,
                    candidate.UserId,
                    universe.Id,
                    protectedDate,
                    cancellationToken);
            }

            if (insertedUsageCount != gapDays)
            {
                await transaction.RollbackAsync(cancellationToken);
                continue;
            }

            var deductedSavers = await DeductStreakSaversAsync(
                connection,
                transaction,
                candidate.UserId,
                gapDays,
                cancellationToken);

            if (!deductedSavers)
            {
                await transaction.RollbackAsync(cancellationToken);
                continue;
            }

            await AdvanceStreakAsync(
                connection,
                transaction,
                candidate,
                universe.Id,
                protectedThroughDate,
                gapDays,
                cancellationToken);

            await transaction.CommitAsync(cancellationToken);
            protectedUserCount++;
        }

        if (protectedUserCount > 0)
        {
            logger.LogInformation(
                "Protected {ProtectedUserCount} missed streak(s) with streak savers for universe {UniverseId}.",
                protectedUserCount,
                universe.Id);
        }

        return protectedUserCount;
    }

    private async Task<IReadOnlyList<StreakSaverCandidate>> LoadCandidatesAsync(
        UniverseDefinition universe,
        DateOnly minimumActiveDate,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              streaks.user_id,
              streaks.current_streak,
              streaks.longest_streak,
              streaks.last_credit_date,
              premium_status.available_streak_savers,
              premium_status.auto_use_streak_savers
            from public."UniverseStreaks" as streaks
            join public."UserPremiumStatus" as premium_status
              on premium_status.user_id = streaks.user_id
            where streaks.universe_id = @universeId
              and streaks.current_streak > 0
              and streaks.last_credit_date < @minimumActiveDate
              and (
                (
                  premium_status.is_premium = true
                  or premium_status.status in ('active', 'trialing', 'past_due')
                )
                and (
                  premium_status.premium_ended_at is null
                  or premium_status.premium_ended_at > now()
                )
                or (
                  premium_status.status = 'canceled'
                  and premium_status.cancel_at_period_end = true
                  and premium_status.current_period_end > now()
                  and (
                    premium_status.premium_ended_at is null
                    or premium_status.premium_ended_at > now()
                  )
                )
              );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("minimumActiveDate", minimumActiveDate);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var candidates = new List<StreakSaverCandidate>();

        while (await reader.ReadAsync(cancellationToken))
        {
            candidates.Add(new StreakSaverCandidate(
                reader.GetGuid(0),
                reader.GetInt32(1),
                reader.GetInt32(2),
                reader.GetFieldValue<DateOnly>(3),
                reader.GetInt32(4),
                reader.IsDBNull(5) || reader.GetBoolean(5)));
        }

        return candidates;
    }

    private static IEnumerable<DateOnly> EnumerateProtectedDates(
        DateOnly lastCreditDate,
        DateOnly protectedThroughDate)
    {
        for (var protectedDate = lastCreditDate.AddDays(1);
             protectedDate <= protectedThroughDate;
             protectedDate = protectedDate.AddDays(1))
        {
            yield return protectedDate;
        }
    }

    private static async Task<int> InsertUsageAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        string universeId,
        DateOnly protectedDate,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."UniverseStreakSaverUsages" (
              user_id,
              universe_id,
              protected_date,
              created_at
            )
            values (
              @userId,
              @universeId,
              @protectedDate,
              timezone('utc', now())
            )
            on conflict do nothing;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("protectedDate", protectedDate);
        return await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<bool> DeductStreakSaversAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        int saverCount,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            update public."UserPremiumStatus"
            set
              available_streak_savers = available_streak_savers - @saverCount,
              updated_at = timezone('utc', now())
            where user_id = @userId
              and available_streak_savers >= @saverCount;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("saverCount", saverCount);
        return await command.ExecuteNonQueryAsync(cancellationToken) == 1;
    }

    private static async Task AdvanceStreakAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        StreakSaverCandidate candidate,
        string universeId,
        DateOnly protectedThroughDate,
        int gapDays,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            update public."UniverseStreaks"
            set
              current_streak = @currentStreak,
              longest_streak = @longestStreak,
              last_credit_date = @protectedThroughDate,
              updated_at = timezone('utc', now())
            where user_id = @userId
              and universe_id = @universeId;
            """;

        var nextCurrentStreak = candidate.CurrentStreak + gapDays;
        var nextLongestStreak = Math.Max(candidate.LongestStreak, nextCurrentStreak);

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", candidate.UserId);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("currentStreak", nextCurrentStreak);
        command.Parameters.AddWithValue("longestStreak", nextLongestStreak);
        command.Parameters.AddWithValue("protectedThroughDate", protectedThroughDate);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private sealed record StreakSaverCandidate(
        Guid UserId,
        int CurrentStreak,
        int LongestStreak,
        DateOnly LastCreditDate,
        int AvailableStreakSavers,
        bool AutoUseStreakSavers);
}
