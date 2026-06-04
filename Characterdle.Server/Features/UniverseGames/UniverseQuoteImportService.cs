using System.Text.RegularExpressions;
using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseQuoteImportService(
    NpgsqlDataSource dataSource,
    ILogger<UniverseQuoteImportService> logger)
{
    private static readonly string[] SpeakerTitlePrefixes =
    [
        "lord commander ",
        "magister ",
        "maester ",
        "princess ",
        "prince ",
        "khaleesi ",
        "queen ",
        "khal ",
        "king ",
        "lady ",
        "lord ",
        "ser "
    ];

    public async Task<UniverseQuoteImportResult> ImportAsync(
        string quotesFilePath,
        CancellationToken cancellationToken = default)
    {
        if (!File.Exists(quotesFilePath))
        {
            throw new FileNotFoundException("Quote import file was not found.", quotesFilePath);
        }

        var parsedQuotes = ParseQuotes(await File.ReadAllLinesAsync(quotesFilePath, cancellationToken));

        if (parsedQuotes.Count == 0)
        {
            throw new InvalidOperationException("No quotes were found in the import file.");
        }

        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        var characters = await LoadCharactersAsync(connection, transaction, cancellationToken);
        var speakerMappings = ResolveSpeakers(parsedQuotes, characters);

        var ambiguousSpeakers = speakerMappings
            .Where(mapping => mapping.Value.Count > 1)
            .Select(mapping => $"{mapping.Key} => {string.Join(", ", mapping.Value.Select(character => character.DisplayName))}")
            .ToArray();

        if (ambiguousSpeakers.Length > 0)
        {
            throw new InvalidOperationException(
                "Some speaker names matched multiple characters: " + string.Join(" | ", ambiguousSpeakers));
        }

        var missingSpeakers = speakerMappings
            .Where(mapping => mapping.Value.Count == 0)
            .Select(mapping => mapping.Key)
            .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (missingSpeakers.Length > 0)
        {
            throw new InvalidOperationException(
                "Some speaker names did not match any GOTCharacters rows: " + string.Join(", ", missingSpeakers));
        }

        await ClearQuotesAsync(connection, transaction, cancellationToken);
        await InsertQuotesAsync(connection, transaction, parsedQuotes, speakerMappings, cancellationToken);
        await RelinkGamesAsync(connection, transaction, cancellationToken);

        var verification = await VerifyAsync(connection, transaction, cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        logger.LogInformation(
            "Imported {QuoteCount} quotes from {QuotesFilePath}. GOTGames relinked: {LinkedGameCount}/{GameCount}. Distinct speakers: {SpeakerCount}.",
            verification.QuoteCount,
            quotesFilePath,
            verification.LinkedGameCount,
            verification.GameCount,
            verification.SpeakerCount);

        return new UniverseQuoteImportResult(
            quotesFilePath,
            verification.QuoteCount,
            verification.GameCount,
            verification.LinkedGameCount,
            verification.SpeakerCount);
    }

    private static IReadOnlyList<ParsedQuote> ParseQuotes(IReadOnlyList<string> lines)
    {
        var results = new List<ParsedQuote>();
        int? currentSeason = null;
        int? currentEpisode = null;
        var headingPattern = new Regex(@"^Season\s+(?<season>\d+)\s+Episode\s+(?<episode>\d+)$", RegexOptions.IgnoreCase);

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();

            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var headingMatch = headingPattern.Match(line);

            if (headingMatch.Success)
            {
                currentSeason = int.Parse(headingMatch.Groups["season"].Value);
                currentEpisode = int.Parse(headingMatch.Groups["episode"].Value);
                continue;
            }

            if (!currentSeason.HasValue || !currentEpisode.HasValue)
            {
                throw new InvalidOperationException(
                    $"Found quote text before an episode heading: '{line}'.");
            }

            var separatorIndex = line.IndexOf(':');

            if (separatorIndex <= 0 || separatorIndex == line.Length - 1)
            {
                throw new InvalidOperationException(
                    $"Quote line is not in 'Character: Quote' format: '{line}'.");
            }

            var speaker = line[..separatorIndex].Trim();
            var quoteText = line[(separatorIndex + 1)..].Trim();

            results.Add(new ParsedQuote(
                speaker,
                quoteText,
                currentSeason.Value,
                currentEpisode.Value));
        }

        return results;
    }

    private static async Task<IReadOnlyList<CharacterLookupRecord>> LoadCharactersAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              id,
              display_name,
              aliases
            from public."GOTCharacters";
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        var results = new List<CharacterLookupRecord>();

        while (await reader.ReadAsync(cancellationToken))
        {
            results.Add(new CharacterLookupRecord(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetFieldValue<string[]>(2)));
        }

        return results;
    }

    private static Dictionary<string, List<CharacterLookupRecord>> ResolveSpeakers(
        IReadOnlyList<ParsedQuote> parsedQuotes,
        IReadOnlyList<CharacterLookupRecord> characters)
    {
        var distinctSpeakers = parsedQuotes
            .Select(quote => quote.Speaker)
            .Distinct(StringComparer.OrdinalIgnoreCase);
        var mappings = new Dictionary<string, List<CharacterLookupRecord>>(StringComparer.OrdinalIgnoreCase);

        foreach (var speaker in distinctSpeakers)
        {
            var normalizedSpeakerCandidates = GetMatchCandidates(speaker);
            var matches = characters
                .Where(character => GetCharacterMatchCandidates(character).Any(candidate =>
                    normalizedSpeakerCandidates.Contains(candidate)))
                .ToList();

            mappings[speaker] = matches;
        }

        return mappings;
    }

    private static async Task ClearQuotesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            update public."GOTGames"
            set quote_id = null;

            delete from public."GOTQuotes";
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task InsertQuotesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        IReadOnlyList<ParsedQuote> quotes,
        IReadOnlyDictionary<string, List<CharacterLookupRecord>> speakerMappings,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."GOTQuotes" (
              character_id,
              quote_text,
              season_number,
              episode_number
            )
            values (
              @characterId,
              @quoteText,
              @seasonNumber,
              @episodeNumber
            );
            """;

        foreach (var quote in quotes)
        {
            var character = speakerMappings[quote.Speaker].Single();

            await using var command = new NpgsqlCommand(sql, connection, transaction);
            command.Parameters.AddWithValue("characterId", character.Id);
            command.Parameters.AddWithValue("quoteText", quote.Text);
            command.Parameters.AddWithValue("seasonNumber", quote.SeasonNumber);
            command.Parameters.AddWithValue("episodeNumber", quote.EpisodeNumber);
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
    }

    private static async Task RelinkGamesAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            with quote_pool as (
              select
                quotes.id,
                row_number() over (order by quotes.season_number, quotes.episode_number, quotes.id) - 1 as quote_position
              from public."GOTQuotes" as quotes
            ),
            quote_count as (
              select count(*)::bigint as total
              from quote_pool
            ),
            ranked_games as (
              select
                games.id,
                row_number() over (order by games.datetime, games.id) - 1 as game_position
              from public."GOTGames" as games
            )
            update public."GOTGames" as games
            set quote_id = quote_pool.id
            from ranked_games, quote_count, quote_pool
            where games.id = ranked_games.id
              and quote_count.total > 0
              and quote_pool.quote_position = mod(ranked_games.game_position, quote_count.total);
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<ImportVerification> VerifyAsync(
        NpgsqlConnection connection,
        NpgsqlTransaction transaction,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select
              (select count(*) from public."GOTQuotes") as quote_count,
              (select count(*) from public."GOTGames") as game_count,
              (select count(*) from public."GOTGames" where quote_id is not null) as linked_game_count,
              (select count(distinct character_id) from public."GOTQuotes") as speaker_count;
            """;

        await using var command = new NpgsqlCommand(sql, connection, transaction);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        await reader.ReadAsync(cancellationToken);

        return new ImportVerification(
            reader.GetInt32(0),
            reader.GetInt32(1),
            reader.GetInt32(2),
            reader.GetInt32(3));
    }

    private static string Normalize(string value) =>
        value.Trim().ToLowerInvariant();

    private static HashSet<string> GetMatchCandidates(string value)
    {
        var normalized = Normalize(value);
        var candidates = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            normalized
        };

        var stripped = StripLeadingTitle(normalized);

        if (!string.Equals(stripped, normalized, StringComparison.Ordinal))
        {
            candidates.Add(stripped);
        }

        return candidates;
    }

    private static IEnumerable<string> GetCharacterMatchCandidates(CharacterLookupRecord character)
    {
        yield return Normalize(character.DisplayName);
        yield return StripLeadingTitle(Normalize(character.DisplayName));

        foreach (var alias in character.Aliases)
        {
            yield return Normalize(alias);
            yield return StripLeadingTitle(Normalize(alias));
        }
    }

    private static string StripLeadingTitle(string value)
    {
        foreach (var prefix in SpeakerTitlePrefixes)
        {
            if (value.StartsWith(prefix, StringComparison.Ordinal))
            {
                return value[prefix.Length..].TrimStart();
            }
        }

        return value;
    }

    private readonly record struct ParsedQuote(
        string Speaker,
        string Text,
        int SeasonNumber,
        int EpisodeNumber);

    private readonly record struct CharacterLookupRecord(
        long Id,
        string DisplayName,
        IReadOnlyList<string> Aliases);

    private readonly record struct ImportVerification(
        int QuoteCount,
        int GameCount,
        int LinkedGameCount,
        int SpeakerCount);
}
