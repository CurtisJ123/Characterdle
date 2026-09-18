using System.Security.Cryptography;
using System.Text.Json;
using Npgsql;
using static Characterdle.Server.Features.Admin.AdminCatalogRepository;

namespace Characterdle.Server.Features.Admin;

public sealed class AdminCatalogCreator(NpgsqlDataSource dataSource, IAdminPortraitStorage storage,
    ILogger<AdminCatalogCreator> logger) : IAdminCatalogCreator
{
    public async Task<AdminCharacter> CreateCharacterAsync(CreateAdminCharacter request, ValidatedAdminPortrait? portrait, CancellationToken ct)
    {
        string? objectName = null;
        var commitStarted = false;
        try
        {
            return await CreateAsync(request.RequestId, "character", Hash(request), "public.\"GOTCharacters\"",
                CharacterColumns, Character, row => row.Id, async (connection, transaction) =>
                {
                    var r = request.Character.AsEdit() with { DisplayName = request.Character.DisplayName.Trim() };
                    // Also serialize distinct submissions of the same name, before any upload.
                    await using (var gate = new NpgsqlCommand("select pg_advisory_xact_lock(hashtextextended('catalog-name:' || lower(@name), 0))", connection, transaction))
                    {
                        gate.Parameters.AddWithValue("name", r.DisplayName);
                        await gate.ExecuteNonQueryAsync(ct);
                    }
                    await using (var duplicate = new NpgsqlCommand("select 1 from public.\"GOTCharacters\" where lower(btrim(display_name)) = lower(@name) limit 1", connection, transaction))
                    {
                        duplicate.Parameters.AddWithValue("name", r.DisplayName);
                        if (await duplicate.ExecuteScalarAsync(ct) is not null)
                            throw new AdminCatalogConflictException("A character with this name already exists. Edit that row instead.");
                    }
                    if (portrait is not null)
                    {
                        objectName = $"{Guid.NewGuid():N}.{portrait.Type.Extension}";
                        r = r with { PortraitUrl = await storage.UploadAsync(objectName, portrait, ct) };
                    }
                    await using var cmd = new NpgsqlCommand($"""
                        insert into public."GOTCharacters"
                          (display_name, aliases, gender, species, house, occupation, debut_season, last_season, alive, portrait_url)
                        values (@name, @aliases, @gender, @species, @house, @occupation, @debut, @last, @alive, @portrait)
                        returning {CharacterColumns}
                        """, connection, transaction);
                    CharacterParameters(cmd, r);
                    await using var reader = await cmd.ExecuteReaderAsync(ct);
                    await reader.ReadAsync(ct);
                    return Character(reader);
                }, () => commitStarted = true, ct);
        }
        catch
        {
            // A failed COMMIT response is ambiguous: never delete an image a committed row may use.
            if (objectName is not null && !commitStarted)
            {
                try
                {
                    using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(10));
                    await storage.DeleteAsync(objectName, cleanup.Token);
                }
                catch (Exception ex) { logger.LogWarning(ex, "Could not clean up unused portrait {ObjectName}.", objectName); }
            }
            throw;
        }
    }

    public Task<AdminQuote> CreateQuoteAsync(CreateAdminQuote request, CancellationToken ct) =>
        CreateAsync(request.RequestId, "quote", Hash(request), "public.\"GOTQuotes\"", QuoteColumns, Quote, row => row.Id,
            async (connection, transaction) =>
            {
                var r = request.Quote.AsEdit() with { QuoteText = request.Quote.QuoteText.Trim() };
                await ValidateQuoteReferencesAsync(connection, transaction, r, ct);
                await using var cmd = new NpgsqlCommand($"""
                    insert into public."GOTQuotes" (character_id, quote_text, season_number, episode_number, episode_title_id)
                    values (@character, @text, @season, @episode, @title)
                    returning {QuoteColumns}
                    """, connection, transaction);
                QuoteParameters(cmd, r);
                await using var reader = await cmd.ExecuteReaderAsync(ct);
                await reader.ReadAsync(ct);
                return Quote(reader);
            }, () => { }, ct);

    private async Task<T> CreateAsync<T>(Guid requestId, string kind, string hash, string table, string columns,
        Func<NpgsqlDataReader, T> read, Func<T, long> id, Func<NpgsqlConnection, NpgsqlTransaction, Task<T>> insert,
        Action beforeCommit, CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        // Transaction-scoped lock protects retries across server instances, not just this process.
        await using (var gate = new NpgsqlCommand("select pg_advisory_xact_lock(hashtextextended(@key, 0))", connection, transaction))
        {
            gate.Parameters.AddWithValue("key", $"catalog-request:{requestId}");
            await gate.ExecuteNonQueryAsync(ct);
        }
        long? existingId = null;
        await using (var lookup = new NpgsqlCommand("select resource_type, request_hash, resource_id from public.\"AdminCatalogCreations\" where request_id = @key", connection, transaction))
        {
            lookup.Parameters.AddWithValue("key", requestId);
            await using var reader = await lookup.ExecuteReaderAsync(ct);
            if (await reader.ReadAsync(ct))
            {
                if (reader.GetString(0) != kind || reader.GetString(1) != hash)
                    throw new AdminCatalogConflictException("This save request already created different content. Refresh before adding another row.");
                existingId = reader.GetInt64(2);
            }
        }
        if (existingId is { } savedId)
        {
            // Table/column fragments are private constants, never supplied by the caller's JSON.
            await using var lookup = new NpgsqlCommand($"select {columns} from {table} where id = @id", connection, transaction);
            lookup.Parameters.AddWithValue("id", savedId);
            await using var reader = await lookup.ExecuteReaderAsync(ct);
            if (!await reader.ReadAsync(ct)) throw new AdminCatalogConflictException("The previously created row no longer exists. Refresh the catalog.");
            return read(reader);
        }
        var row = await insert(connection, transaction);
        await using (var log = new NpgsqlCommand("""
            insert into public."AdminCatalogCreations" (request_id, resource_type, request_hash, resource_id)
            values (@key, @kind, @hash, @id)
            """, connection, transaction))
        {
            log.Parameters.AddWithValue("key", requestId);
            log.Parameters.AddWithValue("kind", kind);
            log.Parameters.AddWithValue("hash", hash);
            log.Parameters.AddWithValue("id", id(row));
            await log.ExecuteNonQueryAsync(ct);
        }
        beforeCommit();
        await transaction.CommitAsync(ct);
        return row;
    }

    private static string Hash<T>(T request) => Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(request)));
}
