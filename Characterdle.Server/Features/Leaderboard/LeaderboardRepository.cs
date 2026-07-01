using Characterdle.Server.Features.UniverseGames;
using Npgsql;

namespace Characterdle.Server.Features.Leaderboard;

public sealed class LeaderboardRepository(NpgsqlDataSource dataSource) : ILeaderboardRepository
{
    public async Task<bool> GameExistsAsync(
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            select exists(
              select 1
              from {universe.GameTableName} as games
              where games.id = @gameId
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("gameId", gameId);

        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }

    public async Task EnsurePlayerProfileAsync(
        VerifiedSupabaseUser user,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."PlayerProfiles" (
              user_id,
              display_name,
              email,
              avatar_url
            )
            values (
              @userId,
              @displayName,
              @email,
              @avatarUrl
            )
            on conflict (user_id) do nothing;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", user.UserId);
        command.Parameters.AddWithValue("displayName", user.DisplayName);
        command.Parameters.AddWithValue("email", user.Email);
        command.Parameters.AddWithValue("avatarUrl", (object?)user.AvatarUrl ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<UniverseStreakResponse> UpsertUniverseGameResultAsync(
        Guid userId,
        UniverseDefinition universe,
        long gameId,
        int guessCount,
        int hintCount,
        string mode,
        string status,
        IReadOnlyList<long> guessedCharacterIds,
        IReadOnlyList<string> revealedHintKeys,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."UniverseGameResults" (
              user_id,
              universe_id,
              game_id,
              mode,
              status,
              guess_count,
              hint_count,
              guessed_character_ids,
              revealed_hint_keys,
              completed_at,
              updated_at
            )
            values (
              @userId,
              @universeId,
              @gameId,
              @mode,
              @status,
              @guessCount,
              @hintCount,
              @guessedCharacterIds,
              @revealedHintKeys,
              case
                when @status in ('won', 'lost') then timezone('utc', now())
                else null
              end,
              timezone('utc', now())
            )
            on conflict (user_id, universe_id, game_id, mode) do update
            set
              status = excluded.status,
              guess_count = excluded.guess_count,
              hint_count = excluded.hint_count,
              guessed_character_ids = excluded.guessed_character_ids,
              revealed_hint_keys = excluded.revealed_hint_keys,
              completed_at = case
                when public."UniverseGameResults".status = excluded.status
                  and public."UniverseGameResults".status in ('won', 'lost')
                  then public."UniverseGameResults".completed_at
                else excluded.completed_at
              end,
              updated_at = excluded.updated_at
            where (
              public."UniverseGameResults".status = 'playing'
              and (
                excluded.guess_count + excluded.hint_count
                  > public."UniverseGameResults".guess_count + public."UniverseGameResults".hint_count
                or (
                  excluded.guess_count + excluded.hint_count
                    = public."UniverseGameResults".guess_count + public."UniverseGameResults".hint_count
                  and excluded.status in ('won', 'lost')
                )
              )
            )
            or (
              public."UniverseGameResults".status = 'lost'
              and public."UniverseGameResults".completed_at <= timezone('utc', now()) - interval '30 days'
              and excluded.status = 'playing'
            )
            or (
              public."UniverseGameResults".status = excluded.status
              and public."UniverseGameResults".status in ('won', 'lost')
              and public."UniverseGameResults".guess_count = excluded.guess_count
              and public."UniverseGameResults".hint_count = excluded.hint_count
              and (
                cardinality(excluded.guessed_character_ids)
                  > cardinality(public."UniverseGameResults".guessed_character_ids)
                or cardinality(excluded.revealed_hint_keys)
                  > cardinality(public."UniverseGameResults".revealed_hint_keys)
              )
            );
            """;

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("mode", mode);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("guessCount", guessCount);
        command.Parameters.AddWithValue("hintCount", hintCount);
        command.Parameters.AddWithValue("guessedCharacterIds", guessedCharacterIds.ToArray());
        command.Parameters.AddWithValue("revealedHintKeys", revealedHintKeys.ToArray());
        await command.ExecuteNonQueryAsync(cancellationToken);

        if (mode == "character" && status is "won" or "lost")
        {
            var creditDate = await TryInsertDailyStreakCreditAsync(
                connection,
                transaction,
                userId,
                universe,
                gameId,
                cancellationToken);

            if (creditDate.HasValue)
            {
                await UpdateStreakSummaryAsync(
                    connection,
                    transaction,
                    userId,
                    universe.Id,
                    creditDate.Value,
                    cancellationToken);
            }
        }

        var streak = await LoadStreakAsync(
            connection,
            transaction,
            userId,
            universe,
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return streak;
    }

    private static async Task<DateOnly?> TryInsertDailyStreakCreditAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            insert into public."UniverseStreakCredits" (
              user_id,
              universe_id,
              game_id,
              result_id,
              credit_date,
              credit_type
            )
            select
              results.user_id,
              results.universe_id,
              results.game_id,
              results.id,
              (games.datetime at time zone @scheduleTimeZoneId)::date,
              'daily_completion'
            from public."UniverseGameResults" as results
            join {universe.GameTableName} as games
              on games.id = results.game_id
            where results.user_id = @userId
              and results.universe_id = @universeId
              and results.game_id = @gameId
              and results.mode = 'character'
              and results.status in ('won', 'lost')
              and (games.datetime at time zone @scheduleTimeZoneId)::date
                = (now() at time zone @scheduleTimeZoneId)::date
            on conflict do nothing
            returning credit_date;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("scheduleTimeZoneId", universe.ScheduleTimeZoneId);
        var value = await command.ExecuteScalarAsync(cancellationToken);
        return value is DateOnly creditDate ? creditDate : null;
    }

    private static async Task UpdateStreakSummaryAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        string universeId,
        DateOnly creditDate,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."UniverseStreaks" (
              user_id,
              universe_id,
              current_streak,
              longest_streak,
              last_credit_date,
              updated_at
            )
            values (
              @userId,
              @universeId,
              1,
              1,
              @creditDate,
              timezone('utc', now())
            )
            on conflict (user_id, universe_id) do update
            set
              current_streak = case
                when public."UniverseStreaks".last_credit_date = excluded.last_credit_date
                  then public."UniverseStreaks".current_streak
                when public."UniverseStreaks".last_credit_date = excluded.last_credit_date - 1
                  then public."UniverseStreaks".current_streak + 1
                else 1
              end,
              longest_streak = greatest(
                public."UniverseStreaks".longest_streak,
                case
                  when public."UniverseStreaks".last_credit_date = excluded.last_credit_date
                    then public."UniverseStreaks".current_streak
                  when public."UniverseStreaks".last_credit_date = excluded.last_credit_date - 1
                    then public."UniverseStreaks".current_streak + 1
                  else 1
                end
              ),
              last_credit_date = greatest(
                public."UniverseStreaks".last_credit_date,
                excluded.last_credit_date
              ),
              updated_at = excluded.updated_at;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("creditDate", creditDate);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<UniverseStreakResponse> LoadStreakAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        Guid userId,
        UniverseDefinition universe,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              case
                when streaks.last_credit_date
                  >= (now() at time zone @scheduleTimeZoneId)::date - 1
                  then streaks.current_streak
                else 0
              end as current_streak,
              streaks.longest_streak,
              streaks.last_credit_date
            from public."UniverseStreaks" as streaks
            where streaks.user_id = @userId
              and streaks.universe_id = @universeId;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("scheduleTimeZoneId", universe.ScheduleTimeZoneId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return new UniverseStreakResponse(0, 0, null);
        }

        return new UniverseStreakResponse(
            reader.GetInt32(0),
            reader.GetInt32(1),
            reader.IsDBNull(2) ? null : reader.GetFieldValue<DateOnly>(2));
    }

    public async Task<UniverseLeaderboardResponse> GetLeaderboardAsync(
        UniverseDefinition universe,
        Guid? currentUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        var normalizedLimit = Math.Clamp(limit, 1, 100);
        var leaderboardOverview = await LoadOverviewAsync(universe.Id, cancellationToken);
        var rows = await LoadRowsAsync(universe.Id, currentUserId, normalizedLimit, cancellationToken);
        var currentUser = currentUserId.HasValue
            ? await LoadCurrentUserAsync(universe.Id, currentUserId.Value, cancellationToken)
            : null;
        var streakRows = await LoadStreakRowsAsync(universe, currentUserId, normalizedLimit, cancellationToken);
        var currentUserStreak = currentUserId.HasValue
            ? await LoadCurrentUserStreakAsync(universe, currentUserId.Value, cancellationToken)
            : null;

        return new UniverseLeaderboardResponse(
            universe.Id,
            universe.DisplayName,
            leaderboardOverview.Overall,
            leaderboardOverview.Character,
            leaderboardOverview.Quote,
            currentUser,
            rows,
            currentUserStreak,
            streakRows);
    }

    private async Task<(LeaderboardOverviewResponse Overall, LeaderboardModeOverviewResponse Character, LeaderboardModeOverviewResponse Quote)> LoadOverviewAsync(
        string universeId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              count(distinct results.user_id)::int as player_count,
              count(*)::int as total_plays,
              count(*) filter (where results.status = 'won')::int as total_wins,
              count(*) filter (where results.status = 'won' and results.mode = 'character')::int as total_character_wins,
              count(*) filter (where results.status = 'won' and results.mode = 'quote')::int as total_quote_wins,
              round(avg(results.guess_count) filter (where results.status = 'won')::numeric, 2) as average_guesses,
              count(distinct results.user_id) filter (where results.mode = 'character')::int as character_player_count,
              count(*) filter (where results.mode = 'character')::int as character_total_plays,
              round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'character')::numeric, 2) as character_average_guesses,
              count(distinct results.user_id) filter (where results.mode = 'quote')::int as quote_player_count,
              count(*) filter (where results.mode = 'quote')::int as quote_total_plays,
              round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'quote')::numeric, 2) as quote_average_guesses
            from public."UniverseGameResults" as results
            where results.universe_id = @universeId
              and results.status in ('won', 'lost')
              and results.hint_count = 0;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            var emptyOverall = new LeaderboardOverviewResponse(0, 0, 0, 0, 0, null);
            var emptyMode = new LeaderboardModeOverviewResponse(0, 0, 0, null);
            return (emptyOverall, emptyMode, emptyMode);
        }

        var overall = new LeaderboardOverviewResponse(
            reader.IsDBNull(0) ? 0 : reader.GetInt32(0),
            reader.IsDBNull(1) ? 0 : reader.GetInt32(1),
            reader.IsDBNull(2) ? 0 : reader.GetInt32(2),
            reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
            reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
            GetNullableDouble(reader, 5));
        var character = new LeaderboardModeOverviewResponse(
            reader.IsDBNull(6) ? 0 : reader.GetInt32(6),
            reader.IsDBNull(7) ? 0 : reader.GetInt32(7),
            reader.IsDBNull(3) ? 0 : reader.GetInt32(3),
            GetNullableDouble(reader, 8));
        var quote = new LeaderboardModeOverviewResponse(
            reader.IsDBNull(9) ? 0 : reader.GetInt32(9),
            reader.IsDBNull(10) ? 0 : reader.GetInt32(10),
            reader.IsDBNull(4) ? 0 : reader.GetInt32(4),
            GetNullableDouble(reader, 11));

        return (overall, character, quote);
    }

    private async Task<IReadOnlyList<LeaderboardEntryResponse>> LoadRowsAsync(
        string universeId,
        Guid? currentUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with aggregated as (
              select
                profiles.user_id,
                profiles.display_name,
                profiles.avatar_url,
                count(*) filter (where results.status = 'won')::int as total_wins,
                count(*) filter (where results.status = 'won' and results.mode = 'character')::int as character_wins,
                count(*) filter (where results.status = 'won' and results.mode = 'quote')::int as quote_wins,
                count(*)::int as total_plays,
                count(*) filter (where results.mode = 'character')::int as character_plays,
                count(*) filter (where results.mode = 'quote')::int as quote_plays,
                round(avg(results.guess_count) filter (where results.status = 'won')::numeric, 2) as average_guesses,
                round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'character')::numeric, 2) as character_average_guesses,
                round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'quote')::numeric, 2) as quote_average_guesses,
                max(results.completed_at) as last_completed_at
              from public."PlayerProfiles" as profiles
              join public."UniverseGameResults" as results
                on results.user_id = profiles.user_id
              where results.universe_id = @universeId
                and results.status in ('won', 'lost')
                and results.hint_count = 0
              group by profiles.user_id, profiles.display_name, profiles.avatar_url
            ),
            ranked as (
              select
                dense_rank() over (
                  order by
                    aggregated.total_wins desc,
                    aggregated.character_wins desc,
                    aggregated.quote_wins desc,
                    aggregated.average_guesses asc nulls last,
                    aggregated.total_plays desc,
                    aggregated.last_completed_at desc,
                    aggregated.display_name asc
                )::int as rank,
                aggregated.user_id,
                aggregated.display_name,
                aggregated.avatar_url,
                aggregated.total_wins,
                aggregated.character_wins,
                aggregated.quote_wins,
                aggregated.total_plays,
                aggregated.character_plays,
                aggregated.quote_plays,
                aggregated.average_guesses,
                aggregated.character_average_guesses,
                aggregated.quote_average_guesses,
                round(
                  case
                    when aggregated.total_plays = 0 then 0
                    else (aggregated.total_wins::numeric / aggregated.total_plays::numeric) * 100
                  end,
                  1
                ) as win_rate
              from aggregated
            )
            select
              ranked.rank,
              ranked.user_id,
              ranked.display_name,
              ranked.avatar_url,
              ranked.total_wins,
              ranked.character_wins,
              ranked.quote_wins,
              ranked.total_plays,
              ranked.character_plays,
              ranked.quote_plays,
              ranked.average_guesses,
              ranked.character_average_guesses,
              ranked.quote_average_guesses,
              ranked.win_rate
            from ranked
            order by ranked.rank, ranked.display_name
            limit @limit;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var rows = new List<LeaderboardEntryResponse>();

        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(MapEntry(reader, currentUserId));
        }

        return rows;
    }

    private async Task<LeaderboardEntryResponse?> LoadCurrentUserAsync(
        string universeId,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with aggregated as (
              select
                profiles.user_id,
                profiles.display_name,
                profiles.avatar_url,
                count(*) filter (where results.status = 'won')::int as total_wins,
                count(*) filter (where results.status = 'won' and results.mode = 'character')::int as character_wins,
                count(*) filter (where results.status = 'won' and results.mode = 'quote')::int as quote_wins,
                count(*)::int as total_plays,
                count(*) filter (where results.mode = 'character')::int as character_plays,
                count(*) filter (where results.mode = 'quote')::int as quote_plays,
                round(avg(results.guess_count) filter (where results.status = 'won')::numeric, 2) as average_guesses,
                round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'character')::numeric, 2) as character_average_guesses,
                round(avg(results.guess_count) filter (where results.status = 'won' and results.mode = 'quote')::numeric, 2) as quote_average_guesses,
                max(results.completed_at) as last_completed_at
              from public."PlayerProfiles" as profiles
              join public."UniverseGameResults" as results
                on results.user_id = profiles.user_id
              where results.universe_id = @universeId
                and results.status in ('won', 'lost')
                and results.hint_count = 0
              group by profiles.user_id, profiles.display_name, profiles.avatar_url
            ),
            ranked as (
              select
                dense_rank() over (
                  order by
                    aggregated.total_wins desc,
                    aggregated.character_wins desc,
                    aggregated.quote_wins desc,
                    aggregated.average_guesses asc nulls last,
                    aggregated.total_plays desc,
                    aggregated.last_completed_at desc,
                    aggregated.display_name asc
                )::int as rank,
                aggregated.user_id,
                aggregated.display_name,
                aggregated.avatar_url,
                aggregated.total_wins,
                aggregated.character_wins,
                aggregated.quote_wins,
                aggregated.total_plays,
                aggregated.character_plays,
                aggregated.quote_plays,
                aggregated.average_guesses,
                aggregated.character_average_guesses,
                aggregated.quote_average_guesses,
                round(
                  case
                    when aggregated.total_plays = 0 then 0
                    else (aggregated.total_wins::numeric / aggregated.total_plays::numeric) * 100
                  end,
                  1
                ) as win_rate
              from aggregated
            )
            select
              ranked.rank,
              ranked.user_id,
              ranked.display_name,
              ranked.avatar_url,
              ranked.total_wins,
              ranked.character_wins,
              ranked.quote_wins,
              ranked.total_plays,
              ranked.character_plays,
              ranked.quote_plays,
              ranked.average_guesses,
              ranked.character_average_guesses,
              ranked.quote_average_guesses,
              ranked.win_rate
            from ranked
            where ranked.user_id = @currentUserId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("currentUserId", currentUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return MapEntry(reader, currentUserId);
    }

    private async Task<IReadOnlyList<StreakLeaderboardEntryResponse>> LoadStreakRowsAsync(
        UniverseDefinition universe,
        Guid? currentUserId,
        int limit,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with effective as (
              select
                profiles.user_id,
                profiles.display_name,
                profiles.avatar_url,
                case
                  when streaks.last_credit_date
                    >= (now() at time zone @scheduleTimeZoneId)::date - 1
                    then streaks.current_streak
                  else 0
                end as current_streak,
                streaks.longest_streak,
                streaks.last_credit_date
              from public."UniverseStreaks" as streaks
              join public."PlayerProfiles" as profiles
                on profiles.user_id = streaks.user_id
              where streaks.universe_id = @universeId
                and streaks.longest_streak > 0
            ),
            ranked as (
              select
                dense_rank() over (
                  order by effective.current_streak desc, effective.longest_streak desc
                )::int as rank,
                effective.*
              from effective
            )
            select
              ranked.rank,
              ranked.user_id,
              ranked.display_name,
              ranked.avatar_url,
              ranked.current_streak,
              ranked.longest_streak
            from ranked
            order by
              ranked.rank,
              ranked.last_credit_date desc,
              ranked.display_name
            limit @limit;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("scheduleTimeZoneId", universe.ScheduleTimeZoneId);
        command.Parameters.AddWithValue("limit", limit);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var rows = new List<StreakLeaderboardEntryResponse>();

        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(MapStreakEntry(reader, currentUserId));
        }

        return rows;
    }

    private async Task<StreakLeaderboardEntryResponse?> LoadCurrentUserStreakAsync(
        UniverseDefinition universe,
        Guid currentUserId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with effective as (
              select
                profiles.user_id,
                profiles.display_name,
                profiles.avatar_url,
                case
                  when streaks.last_credit_date
                    >= (now() at time zone @scheduleTimeZoneId)::date - 1
                    then streaks.current_streak
                  else 0
                end as current_streak,
                streaks.longest_streak
              from public."UniverseStreaks" as streaks
              join public."PlayerProfiles" as profiles
                on profiles.user_id = streaks.user_id
              where streaks.universe_id = @universeId
                and streaks.longest_streak > 0
            ),
            ranked as (
              select
                dense_rank() over (
                  order by effective.current_streak desc, effective.longest_streak desc
                )::int as rank,
                effective.*
              from effective
            )
            select
              ranked.rank,
              ranked.user_id,
              ranked.display_name,
              ranked.avatar_url,
              ranked.current_streak,
              ranked.longest_streak
            from ranked
            where ranked.user_id = @currentUserId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("scheduleTimeZoneId", universe.ScheduleTimeZoneId);
        command.Parameters.AddWithValue("currentUserId", currentUserId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? MapStreakEntry(reader, currentUserId)
            : null;
    }

    private static StreakLeaderboardEntryResponse MapStreakEntry(
        NpgsqlDataReader reader,
        Guid? currentUserId)
    {
        var userId = reader.GetGuid(1);

        return new StreakLeaderboardEntryResponse(
            reader.GetInt32(0),
            userId,
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetInt32(4),
            reader.GetInt32(5),
            currentUserId.HasValue && currentUserId.Value == userId);
    }

    private static LeaderboardEntryResponse MapEntry(
        NpgsqlDataReader reader,
        Guid? currentUserId)
    {
        var userId = reader.GetGuid(1);

        return new LeaderboardEntryResponse(
            reader.GetInt32(0),
            userId,
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetInt32(4),
            reader.GetInt32(5),
            reader.GetInt32(6),
            reader.GetInt32(7),
            reader.GetInt32(8),
            reader.GetInt32(9),
            GetNullableDouble(reader, 10),
            GetNullableDouble(reader, 11),
            GetNullableDouble(reader, 12),
            GetRequiredDouble(reader, 13),
            currentUserId.HasValue && currentUserId.Value == userId);
    }

    private static double? GetNullableDouble(NpgsqlDataReader reader, int ordinal)
    {
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        return reader.GetFieldValue<decimal>(ordinal) switch
        {
            var value => (double)value,
        };
    }

    private static double GetRequiredDouble(NpgsqlDataReader reader, int ordinal)
    {
        return reader.GetFieldValue<decimal>(ordinal) switch
        {
            var value => (double)value,
        };
    }
}
