using System.Text.Json;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.UniverseGames;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.EpisodeLadder;

public sealed class EpisodeLadderRepository(NpgsqlDataSource dataSource, UniverseCatalog universes) : IEpisodeLadderRepository
{
    public async Task<LadderGameReference?> GetGameReferenceAsync(long? gameId, CancellationToken cancellationToken)
    {
        const string sql = """
            select games.id, games.datetime,
                (select count(*)::int from public."GOTGames" newer
                 where newer.datetime > games.datetime and newer.datetime <= now())
            from public."GOTGames" games
            where games.datetime <= now() and (@gameId is null or games.id = @gameId)
            order by games.datetime desc limit 1;
            """;
        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("gameId", NpgsqlDbType.Bigint, (object?)gameId ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken)
            ? new LadderGameReference(reader.GetInt64(0), reader.GetFieldValue<DateTimeOffset>(1), reader.GetInt32(2)) : null;
    }

    public async Task<LadderPuzzle?> GetPuzzleAsync(LadderGameReference game, CancellationToken cancellationToken, int difficulty = 1)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var existing = await ReadPuzzleAsync(connection, null, game, difficulty, cancellationToken, requireCompleteSet: true);
        if (existing is not null) return existing;

        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await LockAsync(connection, transaction, $"episode-ladder-puzzle:{game.Id}", cancellationToken);
        IReadOnlyList<LadderEvent>? catalog = null;
        LadderPuzzle? selected = null;
        for (var level = 1; level <= 5; level++)
        {
            var puzzle = await ReadPuzzleAsync(connection, transaction, game, level, cancellationToken);
            if (puzzle is not null)
            {
                if (level == difficulty) selected = puzzle;
                continue;
            }
            catalog ??= await ReadCatalogAsync(connection, transaction, cancellationToken);
            puzzle = EpisodeLadderRules.Generate(game, catalog, level);
            if (puzzle is null) return null;
            if (level == difficulty) selected = puzzle;

            await using (var command = new NpgsqlCommand("""
            insert into public."GOTEpisodeLadderGames" (game_id, difficulty) values (@gameId, @difficulty);
            """, connection, transaction))
            {
                command.Parameters.AddWithValue("gameId", game.Id);
                command.Parameters.AddWithValue("difficulty", level);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
            foreach (var entry in puzzle.Events)
            {
                await using var command = new NpgsqlCommand("""
                insert into public."GOTEpisodeLadderGameEvents" (game_id, difficulty, event_id, correct_position, initial_position)
                values (@gameId, @difficulty, @eventId, @correct, @initial);
                """, connection, transaction);
                command.Parameters.AddWithValue("gameId", game.Id);
                command.Parameters.AddWithValue("difficulty", level);
                command.Parameters.AddWithValue("eventId", entry.Id);
                command.Parameters.AddWithValue("correct", entry.CorrectPosition);
                command.Parameters.AddWithValue("initial", entry.InitialPosition);
                await command.ExecuteNonQueryAsync(cancellationToken);
            }
        }
        await transaction.CommitAsync(cancellationToken);
        return selected;
    }

    public async Task<IReadOnlyList<LadderEvent>> GetEventCatalogAsync(CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await ReadCatalogAsync(connection, null, cancellationToken);
    }

    private static async Task<IReadOnlyList<LadderEvent>> ReadCatalogAsync(NpgsqlConnection connection,
        NpgsqlTransaction? transaction, CancellationToken cancellationToken)
    {
        const string catalogSql = """
            with episodes as (
                select season_number, episode_number, title,
                    row_number() over (order by season_number, episode_number)::int as episode_index
                from public."GOTEpisodeTitles"
            )
            select events.id, events.event_desc, characters.portrait_url,
                events.season_number, events.episode_number, episodes.episode_index,
                events.event_minute, events.event_second, events.storyline, characters.display_name, episodes.title
            from public."GOTEvents" events
            join episodes using (season_number, episode_number)
            left join public."GOTCharacters" characters on characters.id = events.character_id
            where events.is_enabled
            order by events.id;
            """;
        var catalog = new List<LadderEvent>();
        await using var command = new NpgsqlCommand(catalogSql, connection, transaction);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) catalog.Add(ReadEvent(reader));
        return catalog;
    }

    public async Task<long[][]> GetAttemptsAsync(Guid userId, long gameId, CancellationToken cancellationToken, int difficulty = 1)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await ReadAttemptsAsync(connection, null, userId, gameId, difficulty, cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetDifficultyStatesAsync(Guid userId, long gameId, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand("""
            select difficulty::int, status from public."GOTEpisodeLadderProgress"
            where user_id = @userId and game_id = @gameId;
            """);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("gameId", gameId);
        var states = Enumerable.Repeat("pending", 5).ToArray();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken)) states[reader.GetInt32(0) - 1] = reader.GetString(1);
        return states;
    }

    public async Task<EpisodeLadderResponse> SubmitAsync(LadderPuzzle puzzle, Guid? userId, Guid? guestId,
        long[][] attempts, bool importGuest, CancellationToken cancellationToken)
    {
        var result = EpisodeLadderRules.Replay(puzzle, attempts);
        var summaryStatus = result.Status;
        var summaryAttempts = attempts;
        UniverseStreakResponse? streak = null;
        if (importGuest && result.Status != "won")
            throw new LadderValidationException("Only completed guest victories can be imported.");

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        if (userId.HasValue)
        {
            // Serialize even the first submission, before a result row exists.
            await LockAsync(connection, transaction, $"episode-ladder-result:{userId}:{puzzle.Game.Id}", cancellationToken);
            var saved = await ReadAttemptsAsync(connection, transaction, userId.Value, puzzle.Game.Id, puzzle.Difficulty, cancellationToken);
            if (!EpisodeLadderRules.IsPrefix(saved, attempts)
                || (attempts.Length > saved.Length + 1 && !(importGuest && saved.Length == 0)))
                throw new LadderConflictException(EpisodeLadderRules.Replay(puzzle, saved));

            await using (var progress = new NpgsqlCommand("""
                insert into public."GOTEpisodeLadderProgress" (user_id, game_id, difficulty, attempts, status)
                values (@userId, @gameId, @difficulty, @attempts, @status)
                on conflict (user_id, game_id, difficulty) do update set
                    attempts = excluded.attempts, status = excluded.status, updated_at = now();
                """, connection, transaction))
            {
                progress.Parameters.AddWithValue("userId", userId.Value);
                progress.Parameters.AddWithValue("gameId", puzzle.Game.Id);
                progress.Parameters.AddWithValue("difficulty", puzzle.Difficulty);
                progress.Parameters.AddWithValue("attempts", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(attempts));
                progress.Parameters.AddWithValue("status", result.Status);
                await progress.ExecuteNonQueryAsync(cancellationToken);
            }
            // Keep the shared archive/history row as the best completed difficulty, not five duplicate daily results.
            await using (var summary = new NpgsqlCommand("""
                select attempts::text, status from public."GOTEpisodeLadderProgress"
                where user_id = @userId and game_id = @gameId
                order by case status when 'won' then 0 when 'lost' then 1 else 2 end, difficulty desc limit 1;
                """, connection, transaction))
            {
                summary.Parameters.AddWithValue("userId", userId.Value);
                summary.Parameters.AddWithValue("gameId", puzzle.Game.Id);
                await using var reader = await summary.ExecuteReaderAsync(cancellationToken);
                if (await reader.ReadAsync(cancellationToken))
                {
                    summaryAttempts = JsonSerializer.Deserialize<long[][]>(reader.GetString(0))!;
                    summaryStatus = reader.GetString(1);
                }
            }

            await using var command = new NpgsqlCommand("""
                insert into public."UniverseGameResults"
                    (user_id, universe_id, game_id, mode, status, guess_count, hint_count,
                     episode_ladder_attempts, completed_at, updated_at)
                values (@userId, 'got', @gameId, 'episode_ladder', @status, @count, 0,
                    @attempts, case when @status = 'playing' then null else now() end, now())
                on conflict (user_id, universe_id, game_id, mode) do update set
                    status = excluded.status, guess_count = excluded.guess_count,
                    episode_ladder_attempts = excluded.episode_ladder_attempts,
                    completed_at = coalesce(public."UniverseGameResults".completed_at, excluded.completed_at),
                    updated_at = excluded.updated_at;
                """, connection, transaction);
            command.Parameters.AddWithValue("userId", userId.Value);
            command.Parameters.AddWithValue("gameId", puzzle.Game.Id);
            command.Parameters.AddWithValue("status", summaryStatus);
            command.Parameters.AddWithValue("count", summaryAttempts.Length);
            command.Parameters.AddWithValue("attempts", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(summaryAttempts));
            await command.ExecuteNonQueryAsync(cancellationToken);
            if (!universes.TryGet("got", out var universe)) throw new InvalidOperationException("Game of Thrones is not configured.");
            if (summaryStatus is "won" or "lost")
            {
                await using var credit = DailyStreakCreditCommand.Create(universe, userId.Value, puzzle.Game.Id, "episode_ladder");
                credit.Connection = connection;
                credit.Transaction = transaction;
                await credit.ExecuteNonQueryAsync(cancellationToken);
            }
            streak = await LeaderboardRepository.LoadStreakAsync(connection, transaction, userId.Value, universe, cancellationToken);
        }

        // Guest histories remain in the browser, as in Quote; only aggregate play data is stored.
        var participantKey = userId.HasValue ? $"user:{userId}" : guestId.HasValue ? $"guest:{guestId}" : null;
        if (participantKey is not null)
        {
            await using var command = new NpgsqlCommand("""
                insert into public."UniverseGamePlays"
                    (universe_id, game_id, mode, participant_key, status, guess_count, hint_count, completed_at)
                values ('got', @gameId, 'episode_ladder', @participantKey, @status, @count, 0,
                    case when @status = 'playing' then null else now() end)
                on conflict (universe_id, game_id, mode, participant_key) do update set
                    status = excluded.status, guess_count = excluded.guess_count,
                    completed_at = excluded.completed_at, updated_at = now()
                where public."UniverseGamePlays".status = 'playing'
                    or (public."UniverseGamePlays".status = 'lost' and excluded.status <> 'playing')
                    or excluded.status = 'won';
                """, connection, transaction);
            command.Parameters.AddWithValue("gameId", puzzle.Game.Id);
            command.Parameters.AddWithValue("participantKey", participantKey);
            command.Parameters.AddWithValue("status", summaryStatus);
            command.Parameters.AddWithValue("count", summaryAttempts.Length);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await transaction.CommitAsync(cancellationToken);
        return result with { Streak = streak, Difficulties = userId.HasValue
            ? await GetDifficultyStatesAsync(userId.Value, puzzle.Game.Id, cancellationToken) : null };
    }

    private static async Task LockAsync(NpgsqlConnection connection, NpgsqlTransaction transaction,
        string key, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("select pg_advisory_xact_lock(hashtextextended(@key, 0));", connection, transaction);
        command.Parameters.AddWithValue("key", key);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<long[][]> ReadAttemptsAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction,
        Guid userId, long gameId, int difficulty, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            select attempts::text from public."GOTEpisodeLadderProgress"
            where user_id = @userId and game_id = @gameId and difficulty = @difficulty;
            """, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("difficulty", difficulty);
        return await command.ExecuteScalarAsync(cancellationToken) is string json
            ? JsonSerializer.Deserialize<long[][]>(json) ?? [] : [];
    }

    private static async Task<LadderPuzzle?> ReadPuzzleAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction,
        LadderGameReference game, int difficulty, CancellationToken cancellationToken, bool requireCompleteSet = false)
    {
        const string sql = """
            select events.id, events.event_desc, characters.portrait_url,
                events.season_number, events.episode_number, 0 as episode_index,
                events.event_minute, events.event_second, events.storyline, characters.display_name, episodes.title,
                selected.correct_position::int, selected.initial_position::int, ladder.difficulty::int
            from public."GOTEpisodeLadderGames" ladder
            join public."GOTEpisodeLadderGameEvents" selected on selected.game_id = ladder.game_id and selected.difficulty = ladder.difficulty
            join public."GOTEvents" events on events.id = selected.event_id
            join public."GOTEpisodeTitles" episodes using (season_number, episode_number)
            left join public."GOTCharacters" characters on characters.id = events.character_id
            where ladder.game_id = @gameId and ladder.difficulty = @difficulty
                and (not @requireCompleteSet or 5 = (
                    select count(*) from (
                        select difficulty from public."GOTEpisodeLadderGameEvents"
                        where game_id = @gameId and difficulty between 1 and 5
                        group by difficulty having count(*) = 5
                    ) complete_difficulties
                ))
            order by selected.initial_position;
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("gameId", game.Id);
        command.Parameters.AddWithValue("difficulty", difficulty);
        command.Parameters.AddWithValue("requireCompleteSet", requireCompleteSet);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var events = new List<LadderEvent>();
        while (await reader.ReadAsync(cancellationToken))
        {
            events.Add(ReadEvent(reader) with { CorrectPosition = reader.GetInt32(11), InitialPosition = reader.GetInt32(12) });
            difficulty = reader.GetInt32(13);
        }
        return events.Count == 5 ? new LadderPuzzle(game, difficulty, events) : null;
    }

    private static LadderEvent ReadEvent(NpgsqlDataReader reader) => new(reader.GetInt64(0), reader.GetString(1),
        reader.IsDBNull(2) ? null : SafePortrait(reader.GetString(2)), reader.GetInt32(3), reader.GetInt32(4),
        reader.GetInt32(5), reader.GetInt32(6), reader.GetInt32(7), reader.IsDBNull(8) ? null : reader.GetString(8),
        CharacterName: reader.IsDBNull(9) ? null : reader.GetString(9),
        EpisodeTitle: reader.IsDBNull(10) ? null : reader.GetString(10));

    private static string? SafePortrait(string value) =>
        (value.StartsWith("/images/", StringComparison.Ordinal) && !value.Contains('\\'))
        || (Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps) ? value : null;
}
