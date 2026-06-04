using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseCharacterCleanupService(
    NpgsqlDataSource dataSource,
    ILogger<UniverseCharacterCleanupService> logger)
{
    public async Task<UniverseCharacterCleanupResult> CleanupAsync(
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken = default)
    {
        if (characterIds.Count == 0)
        {
            throw new InvalidOperationException("At least one character id is required.");
        }

        var distinctCharacterIds = characterIds
            .Distinct()
            .OrderBy(id => id)
            .ToArray();

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var charactersToDelete = await LoadCharactersToDeleteAsync(connection, transaction, distinctCharacterIds, cancellationToken);
        var missingCharacterIds = distinctCharacterIds.Except(charactersToDelete.Select(character => character.Id)).ToArray();

        if (missingCharacterIds.Length > 0)
        {
            throw new InvalidOperationException(
                $"These character ids were not found: {string.Join(", ", missingCharacterIds)}.");
        }

        var affectedGames = await LoadAffectedGamesAsync(connection, transaction, distinctCharacterIds, cancellationToken);
        var replacementCharacters = await LoadReplacementCharactersAsync(connection, transaction, distinctCharacterIds, cancellationToken);

        if (replacementCharacters.Count == 0 && affectedGames.Any(game => game.CharacterNeedsReplacement))
        {
            throw new InvalidOperationException("No replacement characters are available.");
        }

        var replacementQuotes = await LoadReplacementQuotesAsync(connection, transaction, distinctCharacterIds, cancellationToken);

        if (replacementQuotes.Count == 0 && affectedGames.Any(game => game.QuoteNeedsReplacement))
        {
            throw new InvalidOperationException("No replacement quotes are available.");
        }

        var replacementQuotesByCharacterId = replacementQuotes
            .GroupBy(quote => quote.CharacterId)
            .ToDictionary(group => group.Key, group => group.ToList());

        var reassignedGameCount = 0;

        foreach (var game in affectedGames)
        {
            var replacementCharacterId = game.CharacterNeedsReplacement
                ? SelectReplacementCharacter(replacementCharacters, game.PlayedAt, game.Id).Id
                : game.CharacterId;

            long? replacementQuoteId = game.QuoteNeedsReplacement
                ? SelectReplacementQuote(replacementQuotes, replacementQuotesByCharacterId, replacementCharacterId, game.PlayedAt).Id
                : game.QuoteId;

            await UpdateGameAsync(
                connection,
                transaction,
                game.Id,
                replacementCharacterId,
                replacementQuoteId,
                cancellationToken);

            reassignedGameCount++;
        }

        var deletedQuoteCount = await DeleteCharactersAsync(connection, transaction, distinctCharacterIds, cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        var deletedCharacters = charactersToDelete
            .Select(character => new DeletedCharacterRecord(character.Id, character.DisplayName, character.PortraitUrl))
            .ToArray();

        logger.LogInformation(
            "Deleted {CharacterCount} characters, removed {QuoteCount} related quotes, and reassigned {GameCount} games.",
            deletedCharacters.Length,
            deletedQuoteCount,
            reassignedGameCount);

        return new UniverseCharacterCleanupResult(
            deletedCharacters,
            deletedQuoteCount,
            reassignedGameCount);
    }

    private static async Task<List<CharacterDeleteCandidate>> LoadCharactersToDeleteAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              characters.id,
              characters.display_name,
              characters.portrait_url
            from public."GOTCharacters" as characters
            where characters.id = any(@characterIds)
            order by characters.id;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<CharacterDeleteCandidate>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new CharacterDeleteCandidate(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.IsDBNull(2) ? null : reader.GetString(2)));
        }

        return results;
    }

    private static async Task<List<AffectedGameRecord>> LoadAffectedGamesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              games.id,
              games.datetime,
              games.character_id,
              games.quote_id,
              coalesce(quotes.character_id = any(@characterIds), false) as quote_needs_replacement
            from public."GOTGames" as games
            left join public."GOTQuotes" as quotes
              on quotes.id = games.quote_id
            where games.character_id = any(@characterIds)
               or coalesce(quotes.character_id = any(@characterIds), false)
            order by games.datetime, games.id;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var deletedCharacterIds = new HashSet<long>(characterIds);
        var results = new List<AffectedGameRecord>();

        while (await reader.ReadAsync(cancellationToken))
        {
            var currentCharacterId = reader.GetInt64(2);

            results.Add(new AffectedGameRecord(
                reader.GetInt64(0),
                reader.GetFieldValue<DateTimeOffset>(1),
                currentCharacterId,
                deletedCharacterIds.Contains(currentCharacterId),
                reader.IsDBNull(3) ? null : reader.GetInt64(3),
                reader.GetBoolean(4)));
        }

        return results;
    }

    private static async Task<List<ReplacementCharacterRecord>> LoadReplacementCharactersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              characters.id,
              count(games.id)::int as usage_count,
              max(games.datetime) as last_used_at
            from public."GOTCharacters" as characters
            left join public."GOTGames" as games
              on games.character_id = characters.id
            where characters.id <> all(@characterIds)
            group by characters.id
            order by characters.id;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<ReplacementCharacterRecord>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new ReplacementCharacterRecord(
                reader.GetInt64(0),
                reader.GetInt32(1),
                reader.IsDBNull(2) ? null : reader.GetFieldValue<DateTimeOffset>(2)));
        }

        return results;
    }

    private static async Task<List<ReplacementQuoteRecord>> LoadReplacementQuotesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              quotes.id,
              quotes.character_id,
              count(games.id)::int as usage_count,
              max(games.datetime) as last_used_at
            from public."GOTQuotes" as quotes
            left join public."GOTGames" as games
              on games.quote_id = quotes.id
            where quotes.character_id <> all(@characterIds)
            group by quotes.id, quotes.character_id
            order by quotes.id;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<ReplacementQuoteRecord>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new ReplacementQuoteRecord(
                reader.GetInt64(0),
                reader.GetInt64(1),
                reader.GetInt32(2),
                reader.IsDBNull(3) ? null : reader.GetFieldValue<DateTimeOffset>(3)));
        }

        return results;
    }

    private static ReplacementCharacterRecord SelectReplacementCharacter(
        List<ReplacementCharacterRecord> replacementCharacters,
        DateTimeOffset playedAt,
        long gameId)
    {
        var selectedCharacter = replacementCharacters
            .OrderBy(character => character.UsageCount)
            .ThenBy(character => character.LastUsedAt ?? DateTimeOffset.MinValue)
            .ThenBy(character => StableTieBreak(gameId, character.Id))
            .First();

        var updatedCharacter = selectedCharacter with
        {
            UsageCount = selectedCharacter.UsageCount + 1,
            LastUsedAt = playedAt
        };
        var index = replacementCharacters.FindIndex(character => character.Id == selectedCharacter.Id);
        replacementCharacters[index] = updatedCharacter;
        return updatedCharacter;
    }

    private static ReplacementQuoteRecord SelectReplacementQuote(
        List<ReplacementQuoteRecord> replacementQuotes,
        IReadOnlyDictionary<long, List<ReplacementQuoteRecord>> replacementQuotesByCharacterId,
        long preferredCharacterId,
        DateTimeOffset playedAt)
    {
        var preferredPool = replacementQuotesByCharacterId.TryGetValue(preferredCharacterId, out var quotesForCharacter)
            ? quotesForCharacter
            : [];

        var selectedQuote = (preferredPool.Count > 0 ? preferredPool : replacementQuotes)
            .OrderBy(quote => quote.UsageCount)
            .ThenBy(quote => quote.LastUsedAt ?? DateTimeOffset.MinValue)
            .ThenBy(quote => quote.Id)
            .First();

        var updatedQuote = selectedQuote with
        {
            UsageCount = selectedQuote.UsageCount + 1,
            LastUsedAt = playedAt
        };

        var globalIndex = replacementQuotes.FindIndex(quote => quote.Id == selectedQuote.Id);
        replacementQuotes[globalIndex] = updatedQuote;

        if (replacementQuotesByCharacterId.TryGetValue(selectedQuote.CharacterId, out var scopedQuotes))
        {
            var scopedIndex = scopedQuotes.FindIndex(quote => quote.Id == selectedQuote.Id);

            if (scopedIndex >= 0)
            {
                scopedQuotes[scopedIndex] = updatedQuote;
            }
        }

        return updatedQuote;
    }

    private static async Task UpdateGameAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        long gameId,
        long characterId,
        long? quoteId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            update public."GOTGames"
            set
              character_id = @characterId,
              quote_id = @quoteId
            where id = @gameId;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("characterId", characterId);
        command.Parameters.AddWithValue("quoteId", (object?)quoteId ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<int> DeleteCharactersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<long> characterIds,
        CancellationToken cancellationToken)
    {
        const string countQuotesSql =
            """
            select count(*)
            from public."GOTQuotes"
            where character_id = any(@characterIds);
            """;

        await using var countCommand = new NpgsqlCommand(countQuotesSql, connection, transaction);
        countCommand.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        var quoteCount = await countCommand.ExecuteScalarAsync(cancellationToken);

        const string deleteCharactersSql =
            """
            delete from public."GOTCharacters"
            where id = any(@characterIds);
            """;

        await using var deleteCommand = new NpgsqlCommand(deleteCharactersSql, connection, transaction);
        deleteCommand.Parameters.AddWithValue("characterIds", characterIds.ToArray());
        await deleteCommand.ExecuteNonQueryAsync(cancellationToken);

        return quoteCount switch
        {
            long value => (int)value,
            int value => value,
            _ => 0
        };
    }

    private static long StableTieBreak(long gameId, long characterId)
    {
        unchecked
        {
            return (gameId * 397) ^ characterId;
        }
    }

    private sealed record CharacterDeleteCandidate(
        long Id,
        string DisplayName,
        string? PortraitUrl);

    private sealed record AffectedGameRecord(
        long Id,
        DateTimeOffset PlayedAt,
        long CharacterId,
        bool CharacterNeedsReplacement,
        long? QuoteId,
        bool QuoteNeedsReplacement);

    private sealed record ReplacementCharacterRecord(
        long Id,
        int UsageCount,
        DateTimeOffset? LastUsedAt);

    private sealed record ReplacementQuoteRecord(
        long Id,
        long CharacterId,
        int UsageCount,
        DateTimeOffset? LastUsedAt);
}
