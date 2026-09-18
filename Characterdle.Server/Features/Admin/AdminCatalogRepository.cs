using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Admin;

public sealed class AdminCatalogRepository(NpgsqlDataSource dataSource) : IAdminCatalogRepository
{
    internal const string CharacterColumns = "id, xmin::text, display_name, aliases, gender, species, house, occupation, debut_season, last_season, alive, portrait_url";
    internal const string QuoteColumns = "id, xmin::text, character_id, quote_text, season_number, episode_number, episode_title_id";

    public async Task<IReadOnlyList<AdminCharacter>> CharactersAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"select {CharacterColumns} from public.\"GOTCharacters\" order by id");
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<AdminCharacter>();
        while (await reader.ReadAsync(ct)) rows.Add(Character(reader));
        return rows;
    }

    public async Task<IReadOnlyList<AdminQuote>> QuotesAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"select {QuoteColumns} from public.\"GOTQuotes\" order by id");
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var rows = new List<AdminQuote>();
        while (await reader.ReadAsync(ct)) rows.Add(Quote(reader));
        return rows;
    }

    public async Task<AdminCatalogOptions> OptionsAsync(CancellationToken ct)
    {
        var characters = new List<AdminCharacterOption>();
        await using (var cmd = dataSource.CreateCommand("select id, display_name from public.\"GOTCharacters\" order by display_name, id"))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) characters.Add(new(reader.GetInt64(0), reader.GetString(1)));
        var episodes = new List<AdminEpisode>();
        await using (var cmd = dataSource.CreateCommand("select id, season_number, episode_number, title from public.\"GOTEpisodeTitles\" order by season_number, episode_number, id"))
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
            while (await reader.ReadAsync(ct)) episodes.Add(new(reader.GetInt64(0), reader.GetInt32(1), reader.GetInt32(2), reader.GetString(3)));
        return new(characters, episodes);
    }

    public async Task<AdminCharacter?> UpdateCharacterAsync(long id, SaveAdminCharacter r, CancellationToken ct)
    {
        // xmin changes on every database update, including edits made outside this admin UI.
        // All identifiers are fixed; only values are accepted from the request.
        await using var cmd = dataSource.CreateCommand($"""
            update public."GOTCharacters" set display_name = @name, aliases = @aliases, gender = @gender,
              species = @species, house = @house, occupation = @occupation, debut_season = @debut,
              last_season = @last, alive = @alive, portrait_url = @portrait
            where id = @id and xmin::text = @version
            returning {CharacterColumns}
            """);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("version", r.ExpectedVersion);
        CharacterParameters(cmd, r);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        return await reader.ReadAsync(ct) ? Character(reader) : null;
    }

    internal static void CharacterParameters(NpgsqlCommand cmd, SaveAdminCharacter r)
    {
        cmd.Parameters.AddWithValue("name", r.DisplayName);
        cmd.Parameters.AddWithValue("aliases", NpgsqlDbType.Array | NpgsqlDbType.Text, r.Aliases);
        cmd.Parameters.AddWithValue("gender", r.Gender);
        cmd.Parameters.AddWithValue("species", r.Species);
        cmd.Parameters.AddWithValue("house", NpgsqlDbType.Array | NpgsqlDbType.Text, r.House);
        cmd.Parameters.AddWithValue("occupation", NpgsqlDbType.Array | NpgsqlDbType.Text, r.Occupation);
        cmd.Parameters.AddWithValue("debut", r.DebutSeason);
        cmd.Parameters.AddWithValue("last", r.LastSeason);
        cmd.Parameters.AddWithValue("alive", r.Alive);
        cmd.Parameters.AddWithValue("portrait", NpgsqlDbType.Text, (object?)r.PortraitUrl ?? DBNull.Value);
    }

    public async Task<AdminQuote?> UpdateQuoteAsync(long id, SaveAdminQuote r, CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        await ValidateQuoteReferencesAsync(connection, transaction, r, ct);
        await using var cmd = new NpgsqlCommand($"""
            update public."GOTQuotes" set character_id = @character, quote_text = @text,
              season_number = @season, episode_number = @episode, episode_title_id = @title
            where id = @id and xmin::text = @version
            returning {QuoteColumns}
            """, connection, transaction);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("version", r.ExpectedVersion);
        QuoteParameters(cmd, r);
        AdminQuote? row;
        await using (var reader = await cmd.ExecuteReaderAsync(ct)) row = await reader.ReadAsync(ct) ? Quote(reader) : null;
        await transaction.CommitAsync(ct);
        return row;
    }

    internal static async Task ValidateQuoteReferencesAsync(NpgsqlConnection connection, NpgsqlTransaction transaction, SaveAdminQuote r, CancellationToken ct)
    {
        await using (var character = new NpgsqlCommand("select id from public.\"GOTCharacters\" where id = @id for key share", connection, transaction))
        {
            character.Parameters.AddWithValue("id", r.CharacterId);
            if (await character.ExecuteScalarAsync(ct) is null) throw new AdminCatalogValidationException("The selected character no longer exists.");
        }
        if (r.EpisodeTitleId is { } episodeId)
        {
            await using var episode = new NpgsqlCommand("""
                select id from public."GOTEpisodeTitles"
                where id = @id and season_number = @season and episode_number = @episode for share
                """, connection, transaction);
            episode.Parameters.AddWithValue("id", episodeId);
            episode.Parameters.AddWithValue("season", r.SeasonNumber);
            episode.Parameters.AddWithValue("episode", r.EpisodeNumber);
            if (await episode.ExecuteScalarAsync(ct) is null) throw new AdminCatalogValidationException("Episode title must match the selected season and episode.");
        }
    }

    internal static void QuoteParameters(NpgsqlCommand cmd, SaveAdminQuote r)
    {
        cmd.Parameters.AddWithValue("character", r.CharacterId);
        cmd.Parameters.AddWithValue("text", r.QuoteText);
        cmd.Parameters.AddWithValue("season", r.SeasonNumber);
        cmd.Parameters.AddWithValue("episode", r.EpisodeNumber);
        cmd.Parameters.AddWithValue("title", NpgsqlDbType.Bigint, (object?)r.EpisodeTitleId ?? DBNull.Value);
    }

    internal static AdminCharacter Character(NpgsqlDataReader r) => new(r.GetInt64(0), r.GetString(1), r.GetString(2),
        r.GetFieldValue<string[]>(3), r.GetString(4), r.GetString(5), r.GetFieldValue<string[]>(6), r.GetFieldValue<string[]>(7),
        r.GetInt32(8), r.GetInt32(9), r.GetBoolean(10), r.IsDBNull(11) ? null : r.GetString(11));
    internal static AdminQuote Quote(NpgsqlDataReader r) => new(r.GetInt64(0), r.GetString(1), r.GetInt64(2), r.GetString(3),
        r.GetInt32(4), r.GetInt32(5), r.IsDBNull(6) ? null : r.GetInt64(6));
}
