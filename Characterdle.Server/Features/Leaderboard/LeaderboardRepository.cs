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

    public async Task UpsertUniverseGameResultAsync(
        Guid userId,
        string universeId,
        long gameId,
        int guessCount,
        int hintCount,
        string mode,
        string status,
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
              completed_at
            )
            values (
              @userId,
              @universeId,
              @gameId,
              @mode,
              @status,
              @guessCount,
              @hintCount,
              timezone('utc', now())
            )
            on conflict (user_id, universe_id, game_id, mode) do update
            set
              status = excluded.status,
              guess_count = excluded.guess_count,
              hint_count = excluded.hint_count,
              completed_at = excluded.completed_at;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universeId);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("mode", mode);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("guessCount", guessCount);
        command.Parameters.AddWithValue("hintCount", hintCount);
        await command.ExecuteNonQueryAsync(cancellationToken);
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

        return new UniverseLeaderboardResponse(
            universe.Id,
            universe.DisplayName,
            leaderboardOverview.Overall,
            leaderboardOverview.Character,
            leaderboardOverview.Quote,
            currentUser,
            rows);
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
