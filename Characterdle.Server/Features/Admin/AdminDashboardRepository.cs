using System.Data;
using Npgsql;

namespace Characterdle.Server.Features.Admin;

public sealed class AdminDashboardRepository(NpgsqlDataSource dataSource) : IAdminDashboardRepository
{
    public async Task<AdminDashboardResponse> GetAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        // One read-only snapshot keeps counts consistent without invoking billing or saver reconciliation.
        await using var transaction = await connection.BeginTransactionAsync(IsolationLevel.RepeatableRead, cancellationToken);
        await using (var readOnly = new NpgsqlCommand("set transaction read only", connection, transaction))
            await readOnly.ExecuteNonQueryAsync(cancellationToken);

        DateTimeOffset now;
        await using (var clock = new NpgsqlCommand("select now()", connection, transaction))
        await using (var reader = await clock.ExecuteReaderAsync(cancellationToken))
        {
            await reader.ReadAsync(cancellationToken);
            now = reader.GetFieldValue<DateTimeOffset>(0);
        }
        var since = now.AddDays(-7);

        const string activitySql = """
            select
              (select count(*) from public."PlayerProfiles"),
              (select count(*) from public."PlayerProfiles" where created_at >= @since and created_at <= @now),
              (select count(distinct user_id) from public."UniverseGameResults"
                where mode in ('character', 'quote') and status in ('won', 'lost')),
              count(distinct participant_key),
              count(distinct participant_key) filter (where updated_at >= @since and updated_at <= @now),
              count(*),
              count(*) filter (where status in ('won', 'lost'))
            from public."UniverseGamePlays"
            where mode in ('character', 'quote')
            """;
        long profiles, newProfiles, completedAccounts;
        AdminPlayerCounts players;
        await using (var command = new NpgsqlCommand(activitySql, connection, transaction))
        {
            command.Parameters.AddWithValue("since", since);
            command.Parameters.AddWithValue("now", now);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            await reader.ReadAsync(cancellationToken);
            profiles = reader.GetInt64(0);
            newProfiles = reader.GetInt64(1);
            completedAccounts = reader.GetInt64(2);
            players = new(reader.GetInt64(3), reader.GetInt64(4), reader.GetInt64(5), reader.GetInt64(6));
        }

        // Only grouped subscription state is read. No account IDs, emails, or payment details are returned.
        const string premiumSql = """
            select is_premium, status, cancel_at_period_end, current_period_end, cancel_at, premium_ended_at,
              nullif(btrim(stripe_subscription_id), '') is not null as has_subscription, count(*)
            from public."UserPremiumStatus"
            group by is_premium, status, cancel_at_period_end, current_period_end, cancel_at, premium_ended_at,
              nullif(btrim(stripe_subscription_id), '') is not null
            """;
        var premium = new AdminPremiumCounts();
        await using (var command = new NpgsqlCommand(premiumSql, connection, transaction))
        await using (var reader = await command.ExecuteReaderAsync(cancellationToken))
        {
            while (await reader.ReadAsync(cancellationToken))
                premium = premium.AddGroup(
                    reader.GetInt64(7),
                    !reader.IsDBNull(0) && reader.GetBoolean(0),
                    reader.IsDBNull(1) ? null : reader.GetString(1),
                    !reader.IsDBNull(2) && reader.GetBoolean(2),
                    ReadDate(reader, 3), ReadDate(reader, 4), ReadDate(reader, 5),
                    reader.GetBoolean(6), now);
        }
        await transaction.CommitAsync(cancellationToken);
        return new(now, since, profiles, newProfiles, completedAccounts, premium, players);
    }

    private static DateTimeOffset? ReadDate(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? null : reader.GetFieldValue<DateTimeOffset>(ordinal);
}
