using System.Text.Json;
using Characterdle.Server.Features.Announcements;

namespace Characterdle.Server.Features.Admin;

public static partial class AdminCatalogEndpoints
{
    private static readonly JsonSerializerOptions CreationJson = new(JsonSerializerDefaults.Web);
    // Includes base64 overhead for one 5 MB portrait, plus bounded character fields.
    private const int MaxCreationBytes = 7 * 1024 * 1024;

    private static async Task<IResult> CreateCharacterAsync(HttpRequest http, IAdminCatalogCreator creator, CancellationToken ct)
    {
        var request = await ReadCreationAsync<CreateAdminCharacter>(http, MaxCreationBytes, ct);
        if (request.RequestId == Guid.Empty || request.Character is null) return Invalid("Provide a request ID and character fields.");
        if (AdminCatalogValidation.Validate(request.Character.AsEdit()) is { } error) return Invalid(error);
        ValidatedAdminPortrait? portrait = null;
        if (request.Portrait is { } upload)
        {
            if (request.Character.PortraitUrl is not null) return Invalid("Choose an image upload or a portrait URL, not both.");
            if (string.IsNullOrEmpty(upload.Data) || upload.Data.Length > 4 * ((AnnouncementImages.MaxBytes + 2) / 3))
                return Invalid("Portraits must be non-empty and 5 MB or smaller.");
            byte[] bytes;
            try { bytes = Convert.FromBase64String(upload.Data); }
            catch (FormatException) { return Invalid("Invalid portrait image data."); }
            if (upload.ContentType is not ("image/jpeg" or "image/png" or "image/webp")
                || AnnouncementImages.Validate(bytes, upload.ContentType) is not { } type)
                return Invalid("Choose a valid JPEG, PNG, or WebP image, up to 5 MB.");
            portrait = new(bytes, type);
        }
        var row = await creator.CreateCharacterAsync(request, portrait, ct);
        return Results.Created($"/api/admin/got/characters/{row.Id}", row);
    }

    private static async Task<IResult> CreateQuoteAsync(HttpRequest http, IAdminCatalogCreator creator, CancellationToken ct)
    {
        var request = await ReadCreationAsync<CreateAdminQuote>(http, 128 * 1024, ct);
        if (request.RequestId == Guid.Empty || request.Quote is null) return Invalid("Provide a request ID and quote fields.");
        if (AdminCatalogValidation.Validate(request.Quote.AsEdit()) is { } error) return Invalid(error);
        var row = await creator.CreateQuoteAsync(request, ct);
        return Results.Created($"/api/admin/got/quotes/{row.Id}", row);
    }

    private static async Task<T> ReadCreationAsync<T>(HttpRequest http, int limit, CancellationToken ct)
    {
        if (!http.HasJsonContentType()) throw new AdminCatalogValidationException("Send application/json content.");
        if (http.ContentLength > limit) throw new BadHttpRequestException("Creation request is too large.", 413);
        using var buffer = new MemoryStream();
        var block = new byte[16384];
        while (true)
        {
            var read = await http.Body.ReadAsync(block.AsMemory(0, (int)Math.Min(block.Length, limit + 1L - buffer.Length)), ct);
            if (read == 0) break;
            buffer.Write(block, 0, read);
            if (buffer.Length > limit) throw new BadHttpRequestException("Creation request is too large.", 413);
        }
        try { return JsonSerializer.Deserialize<T>(buffer.GetBuffer().AsSpan(0, (int)buffer.Length), CreationJson)
            ?? throw new AdminCatalogValidationException("Provide the required fields."); }
        catch (JsonException) { throw new AdminCatalogValidationException("Invalid or missing creation fields."); }
    }
}
