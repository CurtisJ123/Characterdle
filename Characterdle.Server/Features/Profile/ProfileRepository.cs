using Characterdle.Server.Features.UniverseGames;
using Npgsql;

namespace Characterdle.Server.Features.Profile;

public sealed class ProfileRepository(NpgsqlDataSource dataSource) : IProfileRepository
{
    public async Task<UserUniverseProfileResponse?> GetProfileAsync(
        UniverseDefinition universe,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var account = await LoadAccountAsync(userId, cancellationToken);

        if (account is null)
        {
            return null;
        }

        var stats = await LoadStatsAsync(universe, userId, cancellationToken);
        var ranks = await LoadRanksAsync(universe.Id, userId, cancellationToken);
        var streak = await LoadStreakAsync(universe, userId, cancellationToken);
        var recentResults = await LoadRecentResultsAsync(universe.Id, userId, cancellationToken);

        return new UserUniverseProfileResponse(
            universe.Id,
            universe.DisplayName,
            account.UserId,
            account.DisplayName,
            account.Email,
            account.AvatarUrl,
            account.MemberSince,
            stats.TotalWins,
            stats.TotalPlays,
            stats.TotalLosses,
            stats.TotalCompletionRate,
            stats.AverageGuesses,
            ranks.OverallRank,
            streak.CurrentStreak,
            streak.LongestStreak,
            new ProfileModeStatsResponse(
                "character",
                stats.CharacterWins,
                stats.CharacterPlays,
                stats.CharacterLosses,
                stats.CharacterAverageGuesses,
                stats.CharacterAverageHints,
                stats.CharacterCompletionRate,
                ranks.CharacterRank),
            new ProfileModeStatsResponse(
                "quote",
                stats.QuoteWins,
                stats.QuotePlays,
                stats.QuoteLosses,
                stats.QuoteAverageGuesses,
                stats.QuoteAverageHints,
                stats.QuoteCompletionRate,
                ranks.QuoteRank),
            recentResults);
    }

    private async Task<StreakRecord> LoadStreakAsync(
        UniverseDefinition universe,
        Guid userId,
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
              streaks.longest_streak
            from public."UniverseStreaks" as streaks
            where streaks.user_id = @userId
              and streaks.universe_id = @universeId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("scheduleTimeZoneId", universe.ScheduleTimeZoneId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        return await reader.ReadAsync(cancellationToken)
            ? new StreakRecord(reader.GetInt32(0), reader.GetInt32(1))
            : new StreakRecord(0, 0);
    }

    public async Task<IReadOnlyList<UniverseGameResultResponse>> GetGameResultsAsync(
        string universeId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              game_id,
              mode,
              status,
              guess_count,
              hint_count,
              guessed_character_ids,
              revealed_hint_keys,
              completed_at,
              updated_at
            from public."UniverseGameResults"
            where universe_id = @universeId
              and user_id = @userId
            order by updated_at desc;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<UniverseGameResultResponse>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new UniverseGameResultResponse(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetFieldValue<long[]>(5),
                reader.GetFieldValue<string[]>(6),
                reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7),
                reader.GetFieldValue<DateTimeOffset>(8)));
        }

        return results;
    }

    public async Task<bool> IsAvatarUrlAvailableAsync(
        UniverseDefinition universe,
        string avatarUrl,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            select exists(
              select 1
              from {universe.CharacterTableName} as characters
              where characters.portrait_url = @avatarUrl
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("avatarUrl", avatarUrl);
        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }

    public async Task UpdateProfileAsync(
        Guid userId,
        string email,
        string displayName,
        string? avatarUrl,
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
            on conflict (user_id) do update
            set
              display_name = excluded.display_name,
              avatar_url = excluded.avatar_url,
              updated_at = timezone('utc', now());
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("displayName", displayName);
        command.Parameters.AddWithValue("email", email);
        command.Parameters.AddWithValue("avatarUrl", (object?)avatarUrl ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task DeleteAccountDataAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            delete from public."UniverseGameResults"
            where user_id = @userId;

            delete from public."UniverseStreaks"
            where user_id = @userId;

            delete from public."PlayerProfiles"
            where user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private async Task<AccountRecord?> LoadAccountAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              user_id,
              display_name,
              email,
              avatar_url,
              created_at
            from public."PlayerProfiles"
            where user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        return new AccountRecord(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),
            reader.GetFieldValue<DateTimeOffset>(4));
    }

    private async Task<StatsRecord> LoadStatsAsync(
        UniverseDefinition universe,
        Guid userId,
        CancellationToken cancellationToken)
    {
        var quoteAvailabilityProjection = string.IsNullOrWhiteSpace(universe.QuoteTableName)
            ? "0::int as quote_total_available"
            : "count(*) filter (where games.quote_id is not null)::int as quote_total_available";
        var sql =
            $"""
            with available_games as (
              select
                count(*)::int as character_total_available,
                {quoteAvailabilityProjection}
              from {universe.GameTableName} as games
              where games.datetime <= now()
            )
            select
              count(*) filter (where results.status = 'won')::int as total_wins,
              count(*)::int as total_plays,
              count(*) filter (where results.status = 'lost')::int as total_losses,
              round(
                case
                  when ((select character_total_available from available_games) + (select quote_total_available from available_games)) = 0 then 0
                  else (count(*) filter (where results.status = 'won')::numeric / ((select character_total_available from available_games) + (select quote_total_available from available_games))::numeric) * 100
                end,
                1
              ) as total_completion_rate,
              round(avg(results.guess_count) filter (where results.status = 'won')::numeric, 2) as average_guesses,
              count(*) filter (where results.mode = 'character' and results.status = 'won')::int as character_wins,
              count(*) filter (where results.mode = 'character')::int as character_plays,
              count(*) filter (where results.mode = 'character' and results.status = 'lost')::int as character_losses,
              round(avg(results.guess_count) filter (where results.mode = 'character' and results.status = 'won')::numeric, 2) as character_average_guesses,
              round(avg(results.hint_count) filter (where results.mode = 'character')::numeric, 2) as character_average_hints,
              round(
                case
                  when (select character_total_available from available_games) = 0 then 0
                  else (count(*) filter (where results.mode = 'character' and results.status = 'won')::numeric / (select character_total_available from available_games)::numeric) * 100
                end,
                1
              ) as character_completion_rate,
              count(*) filter (where results.mode = 'quote' and results.status = 'won')::int as quote_wins,
              count(*) filter (where results.mode = 'quote')::int as quote_plays,
              count(*) filter (where results.mode = 'quote' and results.status = 'lost')::int as quote_losses,
              round(avg(results.guess_count) filter (where results.mode = 'quote' and results.status = 'won')::numeric, 2) as quote_average_guesses,
              round(avg(results.hint_count) filter (where results.mode = 'quote')::numeric, 2) as quote_average_hints,
              round(
                case
                  when (select quote_total_available from available_games) = 0 then 0
                  else (count(*) filter (where results.mode = 'quote' and results.status = 'won')::numeric / (select quote_total_available from available_games)::numeric) * 100
                end,
                1
              ) as quote_completion_rate
            from public."UniverseGameResults" as results
            where results.universe_id = @universeId
              and results.user_id = @userId
              and results.status in ('won', 'lost');
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);

        return new StatsRecord(
            GetInt32(reader, 0),
            GetInt32(reader, 1),
            GetInt32(reader, 2),
            GetRequiredDouble(reader, 3),
            GetNullableDouble(reader, 4),
            GetInt32(reader, 5),
            GetInt32(reader, 6),
            GetInt32(reader, 7),
            GetNullableDouble(reader, 8),
            GetNullableDouble(reader, 9),
            GetRequiredDouble(reader, 10),
            GetInt32(reader, 11),
            GetInt32(reader, 12),
            GetInt32(reader, 13),
            GetNullableDouble(reader, 14),
            GetNullableDouble(reader, 15),
            GetRequiredDouble(reader, 16));
    }

    private async Task<RankRecord> LoadRanksAsync(
        string universeId,
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with aggregated as (
              select
                profiles.user_id,
                profiles.display_name,
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
              group by profiles.user_id, profiles.display_name
            ),
            ranked as (
              select
                aggregated.user_id,
                dense_rank() over (
                  order by
                    aggregated.total_wins desc,
                    aggregated.character_wins desc,
                    aggregated.quote_wins desc,
                    aggregated.average_guesses asc nulls last,
                    aggregated.total_plays desc,
                    aggregated.last_completed_at desc,
                    aggregated.display_name asc
                )::int as overall_rank,
                dense_rank() over (
                  order by
                    aggregated.character_wins desc,
                    aggregated.character_average_guesses asc nulls last,
                    aggregated.character_plays desc,
                    aggregated.total_wins desc,
                    aggregated.last_completed_at desc,
                    aggregated.display_name asc
                )::int as character_rank,
                dense_rank() over (
                  order by
                    aggregated.quote_wins desc,
                    aggregated.quote_average_guesses asc nulls last,
                    aggregated.quote_plays desc,
                    aggregated.total_wins desc,
                    aggregated.last_completed_at desc,
                    aggregated.display_name asc
                )::int as quote_rank
              from aggregated
            )
            select
              ranked.overall_rank,
              ranked.character_rank,
              ranked.quote_rank
            from ranked
            where ranked.user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        if (!await reader.ReadAsync(cancellationToken))
        {
            return new RankRecord(null, null, null);
        }

        return new RankRecord(
            reader.IsDBNull(0) ? null : reader.GetInt32(0),
            reader.IsDBNull(1) ? null : reader.GetInt32(1),
            reader.IsDBNull(2) ? null : reader.GetInt32(2));
    }

    private Task<IReadOnlyList<ProfileRecentResultResponse>> LoadRecentResultsAsync(
        string universeId,
        Guid userId,
        CancellationToken cancellationToken) =>
        LoadCompletedResultsAsync(universeId, userId, limit: 10, cancellationToken);

    private async Task<IReadOnlyList<ProfileRecentResultResponse>> LoadCompletedResultsAsync(
        string universeId,
        Guid userId,
        int? limit,
        CancellationToken cancellationToken)
    {
        var sql =
            """
            select
              game_id,
              mode,
              status,
              guess_count,
              hint_count,
              completed_at
            from public."UniverseGameResults"
            where universe_id = @universeId
              and user_id = @userId
              and status in ('won', 'lost')
            order by completed_at desc
            """;

        if (limit.HasValue)
        {
            sql += "\nlimit @limit;";
        }
        else
        {
            sql += ";";
        }

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("userId", userId);

        if (limit.HasValue)
        {
            command.Parameters.AddWithValue("limit", limit.Value);
        }

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<ProfileRecentResultResponse>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new ProfileRecentResultResponse(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetInt32(3),
                reader.GetInt32(4),
                reader.GetFieldValue<DateTimeOffset>(5)));
        }

        return results;
    }

    private static int GetInt32(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal) ? 0 : reader.GetInt32(ordinal);

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

    private static double GetRequiredDouble(NpgsqlDataReader reader, int ordinal) =>
        reader.IsDBNull(ordinal)
            ? 0
            : reader.GetFieldValue<decimal>(ordinal) switch
            {
                var value => (double)value,
            };

    private sealed record AccountRecord(
        Guid UserId,
        string DisplayName,
        string Email,
        string? AvatarUrl,
        DateTimeOffset MemberSince);

    private sealed record StatsRecord(
        int TotalWins,
        int TotalPlays,
        int TotalLosses,
        double TotalCompletionRate,
        double? AverageGuesses,
        int CharacterWins,
        int CharacterPlays,
        int CharacterLosses,
        double? CharacterAverageGuesses,
        double? CharacterAverageHints,
        double CharacterCompletionRate,
        int QuoteWins,
        int QuotePlays,
        int QuoteLosses,
        double? QuoteAverageGuesses,
        double? QuoteAverageHints,
        double QuoteCompletionRate);

    private sealed record RankRecord(
        int? OverallRank,
        int? CharacterRank,
        int? QuoteRank);

    private sealed record StreakRecord(
        int CurrentStreak,
        int LongestStreak);
}
