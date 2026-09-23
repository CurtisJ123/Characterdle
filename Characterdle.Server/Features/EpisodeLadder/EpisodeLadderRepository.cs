using System.Text.Json;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.UniverseGames;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.EpisodeLadder;

public sealed class EpisodeLadderRepository(NpgsqlDataSource dataSource, UniverseCatalog universes,
    EpisodeLadderPuzzleCache puzzleCache) : IEpisodeLadderRepository
{
    public async Task<LadderGameReference?> GetGameReferenceAsync(long? gameId, CancellationToken cancellationToken) =>
        (await GetGameContextAsync(gameId, null, 1, cancellationToken))?.Game;

    public async Task<LadderGameContext?> GetGameContextAsync(long? gameId, Guid? userId, int difficulty,
        CancellationToken cancellationToken)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        return await ReadGameContextAsync(connection, null, gameId, userId, difficulty, cancellationToken);
    }

    private static async Task<LadderGameContext?> ReadGameContextAsync(NpgsqlConnection connection,
        NpgsqlTransaction? transaction, long? gameId, Guid? userId, int difficulty, CancellationToken cancellationToken)
    {
        const string sql = """
            with selected_game as materialized (
                select games.id, games.datetime,
                    (select count(*)::int from public."GOTGames" newer
                     where newer.datetime > games.datetime and newer.datetime <= now()) as archive_index
                from public."GOTGames" games
                where games.datetime <= now() and (@gameId is null or games.id = @gameId)
                order by games.datetime desc limit 1
            )
            select game.id, game.datetime, game.archive_index,
                progress.difficulty::int, progress.attempts::text, progress.status
            from selected_game game
            left join public."GOTEpisodeLadderProgress" progress
                on progress.game_id = game.id and progress.user_id = @userId;
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("gameId", NpgsqlDbType.Bigint, (object?)gameId ?? DBNull.Value);
        command.Parameters.AddWithValue("userId", NpgsqlDbType.Uuid, (object?)userId ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        LadderGameReference? game = null;
        long[][] attempts = [];
        var states = Enumerable.Repeat("pending", 5).ToArray();
        var points = new int[5];
        while (await reader.ReadAsync(cancellationToken))
        {
            game ??= new LadderGameReference(reader.GetInt64(0), reader.GetFieldValue<DateTimeOffset>(1), reader.GetInt32(2));
            if (reader.IsDBNull(3)) continue;
            var level = reader.GetInt32(3);
            states[level - 1] = reader.GetString(5);
            var savedAttempts = JsonSerializer.Deserialize<long[][]>(reader.GetString(4)) ?? [];
            points[level - 1] = EpisodeLadderScoring.Points(level, states[level - 1], savedAttempts.Length);
            if (level == difficulty) attempts = savedAttempts;
        }
        return game is null ? null : new LadderGameContext(game, attempts, states, points);
    }

    public async Task<LadderPuzzle?> GetPuzzleAsync(LadderGameReference game, CancellationToken cancellationToken, int difficulty = 1)
    {
        if (difficulty is < 1 or > 5) throw new LadderValidationException("Choose a difficulty from 1 to 5.");
        if (puzzleCache.Get(game, difficulty) is { } cached) return cached;
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        var puzzles = await ReadPuzzlesAsync(connection, null, game, cancellationToken);
        if (puzzles.Count == 5)
        {
            puzzleCache.Set(puzzles);
            return puzzles.Single(p => p.Difficulty == difficulty);
        }

        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);
        await LockAsync(connection, transaction, $"episode-ladder-puzzle:{game.Id}", cancellationToken);
        // Re-read after the lock: another request may have generated the missing levels.
        puzzles = await ReadPuzzlesAsync(connection, transaction, game, cancellationToken);
        IReadOnlyList<LadderEvent>? catalog = null;
        var generated = new List<LadderPuzzle>();
        for (var level = 1; level <= 5; level++)
        {
            if (puzzles.Any(p => p.Difficulty == level)) continue;
            catalog ??= await ReadCatalogAsync(connection, transaction, cancellationToken);
            var puzzle = EpisodeLadderRules.Generate(game, catalog, level);
            if (puzzle is null) return null;
            puzzles.Add(puzzle);
            generated.Add(puzzle);
        }
        await using var batch = CreatePuzzleInsertBatch(connection, transaction, generated);
        if (batch.BatchCommands.Count > 0) await batch.ExecuteNonQueryAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        puzzleCache.Set(puzzles);
        return puzzles.Single(p => p.Difficulty == difficulty);
    }

    internal static NpgsqlBatch CreatePuzzleInsertBatch(NpgsqlConnection connection, NpgsqlTransaction transaction,
        IReadOnlyList<LadderPuzzle> puzzles)
    {
        var batch = new NpgsqlBatch(connection, transaction);
        foreach (var puzzle in puzzles)
        {
            var command = new NpgsqlBatchCommand("""
                insert into public."GOTEpisodeLadderGames" (game_id, difficulty, answer_event_ids, initial_order)
                values (@gameId, @difficulty, @answers, @initial);
                """);
            command.Parameters.AddWithValue("gameId", puzzle.Game.Id);
            command.Parameters.AddWithValue("difficulty", puzzle.Difficulty);
            command.Parameters.AddWithValue("answers", NpgsqlDbType.Array | NpgsqlDbType.Bigint,
                puzzle.Events.OrderBy(e => e.CorrectPosition).Select(e => e.Id).ToArray());
            command.Parameters.AddWithValue("initial", NpgsqlDbType.Array | NpgsqlDbType.Smallint,
                puzzle.Events.OrderBy(e => e.InitialPosition).Select(e => (short)e.CorrectPosition).ToArray());
            batch.BatchCommands.Add(command);
        }
        return batch;
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

    private static async Task<(IReadOnlyList<string> States, IReadOnlyList<int> Points)> ReadDifficultyProgressAsync(
        NpgsqlConnection connection, NpgsqlTransaction? transaction, Guid userId, long gameId, CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand("""
            select difficulty::int, status, jsonb_array_length(attempts) from public."GOTEpisodeLadderProgress"
            where user_id = @userId and game_id = @gameId;
            """, connection, transaction);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("gameId", gameId);
        var states = Enumerable.Repeat("pending", 5).ToArray();
        var points = new int[5];
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var level = reader.GetInt32(0);
            states[level - 1] = reader.GetString(1);
            points[level - 1] = EpisodeLadderScoring.Points(level, states[level - 1], reader.GetInt32(2));
        }
        return (states, points);
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
            {
                var currentDay = await ReadDifficultyProgressAsync(connection, transaction, userId.Value, puzzle.Game.Id, cancellationToken);
                throw new LadderConflictException(EpisodeLadderRules.Replay(puzzle, saved) with
                    { Difficulties = currentDay.States, DifficultyPoints = currentDay.Points });
            }

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
        if (!userId.HasValue) return result;
        var day = await ReadDifficultyProgressAsync(connection, null, userId.Value, puzzle.Game.Id, cancellationToken);
        return result with { Streak = streak, Difficulties = day.States, DifficultyPoints = day.Points };
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

    private static async Task<List<LadderPuzzle>> ReadPuzzlesAsync(NpgsqlConnection connection, NpgsqlTransaction? transaction,
        LadderGameReference game, CancellationToken cancellationToken)
    {
        const string sql = """
            select events.id, events.event_desc, characters.portrait_url,
                events.season_number, events.episode_number, 0 as episode_index,
                events.event_minute, events.event_second, events.storyline, characters.display_name, episodes.title,
                selected.correct_position::int,
                array_position(ladder.initial_order, selected.correct_position::smallint)::int, ladder.difficulty::int
            from public."GOTEpisodeLadderGames" ladder
            cross join lateral unnest(ladder.answer_event_ids) with ordinality as selected(event_id, correct_position)
            join public."GOTEvents" events on events.id = selected.event_id
            join public."GOTEpisodeTitles" episodes using (season_number, episode_number)
            left join public."GOTCharacters" characters on characters.id = events.character_id
            where ladder.game_id = @gameId
            order by ladder.difficulty, array_position(ladder.initial_order, selected.correct_position::smallint);
            """;
        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("gameId", game.Id);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var levels = new Dictionary<int, List<LadderEvent>>();
        while (await reader.ReadAsync(cancellationToken))
        {
            var difficulty = reader.GetInt32(13);
            if (!levels.TryGetValue(difficulty, out var events)) levels[difficulty] = events = [];
            events.Add(ReadEvent(reader) with { CorrectPosition = reader.GetInt32(11), InitialPosition = reader.GetInt32(12) });
        }
        if (levels.Values.Any(events => events.Count != 5))
            throw new InvalidOperationException("The stored ladder puzzle is incomplete.");
        return levels.Select(level => new LadderPuzzle(game, level.Key, level.Value)).ToList();
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
