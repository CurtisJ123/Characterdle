using System.Text.Json;
using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class SupabaseUniverseGameRepository(NpgsqlDataSource dataSource) : IUniverseGameRepository
{
    public async Task<IReadOnlyList<UniverseCharacterAvatarOptionResponse>> GetCharacterAvatarOptionsAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            select
              characters.id,
              characters.display_name,
              characters.portrait_url
            from {universe.CharacterTableName} as characters
            where characters.portrait_url is not null
              and btrim(characters.portrait_url) <> ''
            order by characters.display_name;
            """;

        await using var command = dataSource.CreateCommand(sql);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var characters = new List<UniverseCharacterAvatarOptionResponse>();

        while (await reader.ReadAsync(cancellationToken))
        {
            characters.Add(new UniverseCharacterAvatarOptionResponse(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2)));
        }

        return characters;
    }

    public async Task<DateTime?> GetMostRecentGameDateTimeUtcAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            select max(games.datetime)
            from {universe.GameTableName} as games;
            """;

        await using var command = dataSource.CreateCommand(sql);
        var result = await command.ExecuteScalarAsync(cancellationToken);

        return result is DBNull or null
            ? null
            : DateTime.SpecifyKind((DateTime)result, DateTimeKind.Utc);
    }

    public async Task<CurrentUniverseGameResponse?> GetCurrentGameAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken)
    {
        return await GetGameAsync(
            universe,
            "games.datetime <= now()",
            null,
            cancellationToken);
    }

    public async Task<CurrentUniverseGameResponse?> GetGameByIdAsync(
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken)
    {
        return await GetGameAsync(
            universe,
            "games.id = @gameId and games.datetime <= now()",
            command => command.Parameters.AddWithValue("gameId", gameId),
            cancellationToken);
    }

    public async Task<bool> UpsertGamePlayAsync(
        UniverseDefinition universe,
        long gameId,
        string mode,
        string participantKey,
        int guessCount,
        int hintCount,
        string status,
        CancellationToken cancellationToken)
    {
        var sql =
            $"""
            insert into public."UniverseGamePlays" (
              universe_id,
              game_id,
              mode,
              participant_key,
              status,
              guess_count,
              hint_count,
              started_at,
              completed_at,
              updated_at
            )
            select
              @universeId,
              @gameId,
              @mode,
              @participantKey,
              @status,
              @guessCount,
              @hintCount,
              timezone('utc', now()),
              case when @status in ('won', 'lost') then timezone('utc', now()) else null end,
              timezone('utc', now())
            where exists (
              select 1
              from {universe.GameTableName} as games
              where games.id = @gameId
                and games.datetime <= now()
            )
            on conflict (universe_id, game_id, mode, participant_key) do update
            set
              status = case
                when excluded.status in ('won', 'lost') then excluded.status
                else public."UniverseGamePlays".status
              end,
              guess_count = case
                when excluded.status in ('won', 'lost') then excluded.guess_count
                else greatest(public."UniverseGamePlays".guess_count, excluded.guess_count)
              end,
              hint_count = case
                when excluded.status in ('won', 'lost') then excluded.hint_count
                else greatest(public."UniverseGamePlays".hint_count, excluded.hint_count)
              end,
              completed_at = case
                when excluded.status in ('won', 'lost') then timezone('utc', now())
                else public."UniverseGamePlays".completed_at
              end,
              updated_at = timezone('utc', now());
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("mode", mode);
        command.Parameters.AddWithValue("participantKey", participantKey);
        command.Parameters.AddWithValue("status", status);
        command.Parameters.AddWithValue("guessCount", guessCount);
        command.Parameters.AddWithValue("hintCount", hintCount);

        return await command.ExecuteNonQueryAsync(cancellationToken) > 0;
    }

    private async Task<CurrentUniverseGameResponse?> GetGameAsync(
        UniverseDefinition universe,
        string whereClause,
        Action<NpgsqlCommand>? configureCommand,
        CancellationToken cancellationToken)
    {
        var hasQuoteTable = !string.IsNullOrWhiteSpace(universe.QuoteTableName);
        var hasEpisodeTitleTable = hasQuoteTable && !string.IsNullOrWhiteSpace(universe.EpisodeTitleTableName);
        var episodeTitleProjection = hasEpisodeTitleTable
            ? "episode_titles.title"
            : "null::text";
        var quoteProjection = !hasQuoteTable
            ? "null::bigint as quote_id,\n              null::bigint as quote_character_id,\n              null::text as quote_text,\n              null::integer as quote_season_number,\n              null::integer as quote_episode_number,\n              null::text as quote_episode_title,"
            : $"""
              quotes.id as quote_id,
              quotes.character_id as quote_character_id,
              quotes.quote_text,
              quotes.season_number,
              quotes.episode_number,
              {episodeTitleProjection} as quote_episode_title,
            """;
        var quoteJoin = !hasQuoteTable
            ? string.Empty
            : $"""
            left join {universe.QuoteTableName} as quotes
              on quotes.id = games.quote_id
            """;
        var episodeTitleJoin = hasEpisodeTitleTable
            ? $"""
            left join {universe.EpisodeTitleTableName} as episode_titles
              on episode_titles.id = quotes.episode_title_id
            """
            : string.Empty;

        var gameSql =
            $"""
            select
              games.id,
              games.datetime,
              {quoteProjection}
              {BuildCharacterSelectProjection("characters", universe.AttributeDefinitions, 2)}
            from {universe.GameTableName} as games
            join {universe.CharacterTableName} as characters
              on characters.id = games.character_id
            {quoteJoin}
            {episodeTitleJoin}
            where {whereClause}
            order by games.datetime desc
            limit 1;
            """;

        await using var gameCommand = dataSource.CreateCommand(gameSql);
        configureCommand?.Invoke(gameCommand);
        await using var gameReader = await gameCommand.ExecuteReaderAsync(cancellationToken);

        if (!await gameReader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var resolvedGameId = gameReader.GetInt64(0);
        var playedAt = gameReader.GetDateTime(1);
        var quotePrompt = ReadQuotePrompt(gameReader, 2);
        var answerCharacter = ReadCharacter(gameReader, 8, universe.AttributeDefinitions);

        await gameReader.CloseAsync();

        var charactersSql =
            $"""
            select
              {BuildCharacterSelectProjection("characters", universe.AttributeDefinitions, 0)}
            from {universe.CharacterTableName} as characters
            order by characters.display_name;
            """;

        await using var charactersCommand = dataSource.CreateCommand(charactersSql);
        await using var charactersReader = await charactersCommand.ExecuteReaderAsync(cancellationToken);

        var characters = new List<UniverseCharacterRecord>();

        while (await charactersReader.ReadAsync(cancellationToken))
        {
            characters.Add(ReadCharacter(charactersReader, 0, universe.AttributeDefinitions));
        }

        await charactersReader.CloseAsync();
        var modeStats = await LoadModeStatsAsync(universe, resolvedGameId, cancellationToken);
        var characterStats = modeStats.TryGetValue("character", out var resolvedCharacterStats)
            ? resolvedCharacterStats
            : EmptyModeStats();
        UniverseGameModeStatsResponse? quoteStats = null;

        if (hasQuoteTable)
        {
            quoteStats = modeStats.TryGetValue("quote", out var resolvedQuoteStats)
                ? resolvedQuoteStats
                : EmptyModeStats();
        }

        return new CurrentUniverseGameResponse(
            resolvedGameId,
            playedAt,
            universe.Id,
            universe.DisplayName,
            characterStats,
            quoteStats,
            universe.AttributeDefinitions,
            answerCharacter,
            quotePrompt,
            characters);
    }

    public async Task<PreviousUniverseGamesResponse> GetPreviousGamesAsync(
        UniverseDefinition universe,
        CancellationToken cancellationToken)
    {
        var previousGamesSql =
            $"""
            with ranked_games as (
              select
                games.id as game_id,
                games.datetime,
                row_number() over (order by games.datetime desc) as game_rank
              from {universe.GameTableName} as games
              where games.datetime <= now()
            )
            select
              game_id,
              datetime
            from ranked_games
            where game_rank > 1
            order by datetime desc;
            """;

        await using var previousGamesCommand = dataSource.CreateCommand(previousGamesSql);
        await using var previousGamesReader = await previousGamesCommand.ExecuteReaderAsync(cancellationToken);

        var games = new List<PreviousUniverseGameRecord>();

        while (await previousGamesReader.ReadAsync(cancellationToken))
        {
            games.Add(new PreviousUniverseGameRecord(
                previousGamesReader.GetInt64(0),
                previousGamesReader.GetDateTime(1)));
        }

        return new PreviousUniverseGamesResponse(
            universe.Id,
            universe.DisplayName,
            universe.AttributeDefinitions,
            games);
    }

    public async Task<ScheduledUniverseGameCreationResult> CreateScheduledGameAsync(
        UniverseDefinition universe,
        DateTime scheduledAtUtc,
        string selectionSeed,
        CancellationToken cancellationToken)
    {
        var scheduledAt = DateTime.SpecifyKind(scheduledAtUtc, DateTimeKind.Utc);
        var quoteSelectionSql = string.IsNullOrWhiteSpace(universe.QuoteTableName)
            ? "null::bigint as id where false"
            : $"""
              select
                quotes.id
              from {universe.QuoteTableName} as quotes
              left join {universe.GameTableName} as games
                on games.quote_id = quotes.id
              group by quotes.id, quotes.quote_text
              order by
                count(games.id),
                coalesce(max(games.datetime), '-infinity'::timestamptz),
                md5(@selectionSeed || ':quote:' || quotes.id::text || ':' || quotes.quote_text)
              limit 1
            """;
        var insertColumns = string.IsNullOrWhiteSpace(universe.QuoteTableName)
            ? "(datetime, character_id)"
            : "(datetime, character_id, quote_id)";
        var insertValues = string.IsNullOrWhiteSpace(universe.QuoteTableName)
            ? "@scheduledAtUtc, chosen_character.id"
            : "@scheduledAtUtc, chosen_character.id, chosen_quote.id";

        var sql =
            $"""
            with existing_game as (
              select 1 as found
              from {universe.GameTableName} as games
              where games.datetime = @scheduledAtUtc
            ),
            chosen_character as (
              select
                characters.id
              from {universe.CharacterTableName} as characters
              left join {universe.GameTableName} as games
                on games.character_id = characters.id
              group by characters.id, characters.display_name
              order by
                count(games.id),
                coalesce(max(games.datetime), '-infinity'::timestamptz),
                md5(@selectionSeed || ':' || characters.id::text || ':' || characters.display_name)
              limit 1
            ),
            chosen_quote as (
              {quoteSelectionSql}
            ),
            inserted_game as (
              insert into {universe.GameTableName} {insertColumns}
              select {insertValues}
              from chosen_character
              {(!string.IsNullOrWhiteSpace(universe.QuoteTableName) ? "cross join chosen_quote" : string.Empty)}
              where not exists (select 1 from existing_game)
              returning id
            )
            select
              exists(select 1 from chosen_character) as has_characters,
              exists(select 1 from existing_game) as already_exists,
              (select id from inserted_game) as game_id;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("scheduledAtUtc", scheduledAt);
        command.Parameters.AddWithValue("selectionSeed", selectionSeed);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);

        var hasCharacters = reader.GetBoolean(0);
        var alreadyExists = reader.GetBoolean(1);
        long? gameId = reader.IsDBNull(2) ? null : reader.GetInt64(2);

        return new ScheduledUniverseGameCreationResult(
            Created: gameId.HasValue,
            AlreadyExists: alreadyExists,
            HasCharacters: hasCharacters,
            GameId: gameId);
    }

    private async Task<Dictionary<string, UniverseGameModeStatsResponse>> LoadModeStatsAsync(
        UniverseDefinition universe,
        long gameId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              plays.mode,
              count(*)::int as play_count,
              count(*) filter (where plays.status = 'won' and plays.hint_count = 0)::int as average_guess_sample_size,
              round(avg(plays.guess_count) filter (where plays.status = 'won' and plays.hint_count = 0)::numeric, 2) as average_guesses
            from public."UniverseGamePlays" as plays
            where plays.universe_id = @universeId
              and plays.game_id = @gameId
            group by plays.mode;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("gameId", gameId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var statsByMode = new Dictionary<string, UniverseGameModeStatsResponse>(StringComparer.OrdinalIgnoreCase);

        while (await reader.ReadAsync(cancellationToken))
        {
            var mode = reader.GetString(0);
            statsByMode[mode] = new UniverseGameModeStatsResponse(
                PlayCount: reader.GetInt32(1),
                AverageGuessSampleSize: reader.GetInt32(2),
                AverageGuesses: reader.IsDBNull(3) ? null : (double)reader.GetFieldValue<decimal>(3));
        }

        return statsByMode;
    }

    private static UniverseGameModeStatsResponse EmptyModeStats() =>
        new(
            PlayCount: 0,
            AverageGuessSampleSize: 0,
            AverageGuesses: null);

    private static string BuildCharacterSelectProjection(
        string? tableAlias,
        IReadOnlyList<UniverseAttributeDefinition> attributeDefinitions,
        int indentationLevel)
    {
        var indent = new string(' ', indentationLevel == 0 ? 14 : 14);
        var qualifiedPrefix = string.IsNullOrWhiteSpace(tableAlias) ? string.Empty : $"{tableAlias}.";
        var columns = new List<string>
        {
            $"{qualifiedPrefix}id",
            $"{qualifiedPrefix}display_name",
            $"{qualifiedPrefix}aliases",
            $"{qualifiedPrefix}portrait_url",
        };

        columns.AddRange(attributeDefinitions.Select(definition => $"{qualifiedPrefix}{definition.ColumnName}"));

        return string.Join($",\n{indent}", columns);
    }

    private static UniverseCharacterRecord ReadCharacter(
        NpgsqlDataReader reader,
        int offset,
        IReadOnlyList<UniverseAttributeDefinition> attributeDefinitions)
    {
        var attributes = new Dictionary<string, JsonElement>(StringComparer.OrdinalIgnoreCase);

        for (var attributeIndex = 0; attributeIndex < attributeDefinitions.Count; attributeIndex++)
        {
            var definition = attributeDefinitions[attributeIndex];
            var ordinal = offset + 4 + attributeIndex;

            attributes[definition.Key] = definition.Kind switch
            {
                "boolean" => JsonSerializer.SerializeToElement(reader.GetBoolean(ordinal)),
                "list" => JsonSerializer.SerializeToElement(reader.GetFieldValue<string[]>(ordinal)),
                "number" => JsonSerializer.SerializeToElement(reader.GetInt32(ordinal)),
                _ => JsonSerializer.SerializeToElement(reader.GetString(ordinal)),
            };
        }

        return new UniverseCharacterRecord(
            reader.GetInt64(offset),
            reader.GetString(offset + 1),
            reader.GetFieldValue<string[]>(offset + 2),
            reader.IsDBNull(offset + 3) ? null : reader.GetString(offset + 3),
            attributes);
    }

    private static UniverseQuotePromptRecord? ReadQuotePrompt(
        NpgsqlDataReader reader,
        int offset)
    {
        if (reader.IsDBNull(offset))
        {
            return null;
        }

        return new UniverseQuotePromptRecord(
            reader.GetInt64(offset),
            reader.GetInt64(offset + 1),
            reader.GetString(offset + 2),
            reader.GetInt32(offset + 3),
            reader.GetInt32(offset + 4),
            reader.IsDBNull(offset + 5) ? null : reader.GetString(offset + 5));
    }
}
