using System.Text.Json;
using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class SupabaseUniverseGameRepository(NpgsqlDataSource dataSource) : IUniverseGameRepository
{
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

    private async Task<CurrentUniverseGameResponse?> GetGameAsync(
        UniverseDefinition universe,
        string whereClause,
        Action<NpgsqlCommand>? configureCommand,
        CancellationToken cancellationToken)
    {
        var gameSql =
            $"""
            select
              games.id,
              games.datetime,
              {BuildCharacterSelectProjection("characters", universe.AttributeDefinitions, 2)}
            from {universe.GameTableName} as games
            join {universe.CharacterTableName} as characters
              on characters.id = games.character_id
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
        var answerCharacter = ReadCharacter(gameReader, 2, universe.AttributeDefinitions);

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

        return new CurrentUniverseGameResponse(
            resolvedGameId,
            playedAt,
            universe.Id,
            universe.DisplayName,
            universe.AttributeDefinitions,
            answerCharacter,
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
            inserted_game as (
              insert into {universe.GameTableName} (datetime, character_id)
              select @scheduledAtUtc, chosen_character.id
              from chosen_character
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
}
