using System.Buffers.Binary;
using System.Net.Http.Headers;
using System.Threading.RateLimiting;
using Characterdle.Server.Configuration;
using Microsoft.Extensions.Options;

namespace Characterdle.Server.Features.Announcements;

public sealed record AnnouncementImageType(string MediaType, string Extension);
public sealed record UploadedAnnouncementImage(string Url);

public static class AnnouncementImages
{
    public const int MaxBytes = 5 * 1024 * 1024;
    public const string Bucket = "announcement-images";

    // Inspect file headers rather than trusting the browser's filename or Content-Type.
    // This is a raster-format gate, not a full image decoder or malware scanner.
    public static AnnouncementImageType? Validate(ReadOnlySpan<byte> data, string? contentType)
    {
        if (data.Length is 0 or > MaxBytes) return null;
        var mediaType = contentType?.Split(';')[0].Trim().ToLowerInvariant();
        if (mediaType == "image/png" && data.Length >= 45
            && data[..8].SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 })
            && BinaryPrimitives.ReadUInt32BigEndian(data[8..]) == 13 && data.Slice(12, 4).SequenceEqual("IHDR"u8)
            && Dimensions(BinaryPrimitives.ReadUInt32BigEndian(data[16..]), BinaryPrimitives.ReadUInt32BigEndian(data[20..]))
            && data[^12..].SequenceEqual(new byte[] { 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130 }))
            return new(mediaType, "png");
        if (mediaType == "image/gif" && data.Length >= 14
            && (data[..6].SequenceEqual("GIF87a"u8) || data[..6].SequenceEqual("GIF89a"u8))
            && data[^1] == 0x3b
            && Dimensions(BinaryPrimitives.ReadUInt16LittleEndian(data[6..]), BinaryPrimitives.ReadUInt16LittleEndian(data[8..])))
            return new(mediaType, "gif");
        if (mediaType == "image/jpeg" && ValidJpeg(data)) return new(mediaType, "jpg");
        if (mediaType == "image/webp" && ValidWebp(data)) return new(mediaType, "webp");
        return null;
    }

    private static bool Dimensions(uint width, uint height) => width is > 0 and <= 8192
        && height is > 0 and <= 8192 && (ulong)width * height <= 40_000_000;

    private static bool ValidJpeg(ReadOnlySpan<byte> data)
    {
        if (data.Length < 12 || data[0] != 0xff || data[1] != 0xd8 || data[^2] != 0xff || data[^1] != 0xd9) return false;
        var foundFrame = false;
        for (var offset = 2; offset + 3 < data.Length;)
        {
            if (data[offset++] != 0xff) return false;
            while (offset < data.Length && data[offset] == 0xff) offset++;
            if (offset >= data.Length) return false;
            var marker = data[offset++];
            if (marker == 0xda) return foundFrame;
            if (marker is 0xd9 or 0x00 || offset + 2 > data.Length) return false;
            var length = BinaryPrimitives.ReadUInt16BigEndian(data[offset..]);
            if (length < 2 || offset + length > data.Length) return false;
            if (marker is 0xc0 or 0xc1 or 0xc2)
            {
                if (length < 8 || !Dimensions(BinaryPrimitives.ReadUInt16BigEndian(data[(offset + 5)..]),
                    BinaryPrimitives.ReadUInt16BigEndian(data[(offset + 3)..]))) return false;
                foundFrame = true;
            }
            offset += length;
        }
        return false;
    }

    private static bool ValidWebp(ReadOnlySpan<byte> data)
    {
        if (data.Length < 25 || !data[..4].SequenceEqual("RIFF"u8) || !data.Slice(8, 4).SequenceEqual("WEBP"u8)
            || BinaryPrimitives.ReadUInt32LittleEndian(data[4..]) != data.Length - 8) return false;
        var chunkLength = BinaryPrimitives.ReadUInt32LittleEndian(data[16..]);
        if (chunkLength > data.Length - 20) return false;
        if (data.Slice(12, 4).SequenceEqual("VP8X"u8) && chunkLength == 10)
            return Dimensions(1 + UInt24(data[24..]), 1 + UInt24(data[27..]));
        if (data.Slice(12, 4).SequenceEqual("VP8 "u8) && chunkLength >= 10 && data.Slice(23, 3).SequenceEqual(new byte[] { 0x9d, 0x01, 0x2a }))
            return Dimensions((uint)(BinaryPrimitives.ReadUInt16LittleEndian(data[26..]) & 0x3fff),
                (uint)(BinaryPrimitives.ReadUInt16LittleEndian(data[28..]) & 0x3fff));
        if (data.Slice(12, 4).SequenceEqual("VP8L"u8) && chunkLength >= 5 && data[20] == 0x2f)
        {
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(data[21..]);
            return Dimensions(1 + (bits & 0x3fff), 1 + ((bits >> 14) & 0x3fff));
        }
        return false;
    }

    private static uint UInt24(ReadOnlySpan<byte> data) => (uint)(data[0] | data[1] << 8 | data[2] << 16);
}

public interface IAnnouncementImageStorage
{
    Task<UploadedAnnouncementImage> UploadAsync(byte[] data, AnnouncementImageType type, CancellationToken ct);
}

public sealed class SupabaseAnnouncementImageStorage(HttpClient client, IOptions<SupabaseOptions> options) : IAnnouncementImageStorage
{
    public async Task<UploadedAnnouncementImage> UploadAsync(byte[] data, AnnouncementImageType type, CancellationToken ct)
    {
        var config = options.Value;
        if (string.IsNullOrWhiteSpace(config.ServiceRoleKey)) throw new InvalidOperationException("Announcement image storage is not configured.");
        var path = $"{AnnouncementImages.Bucket}/{Guid.NewGuid():N}.{type.Extension}";
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/storage/v1/object/{path}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", config.ServiceRoleKey);
        request.Headers.Add("apikey", config.ServiceRoleKey);
        request.Headers.Add("x-upsert", "false");
        request.Content = new ByteArrayContent(data);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(type.MediaType);
        using var response = await SendAsync(request, ct);
        // Never surface the upstream response body, which may contain internal configuration details.
        if (!response.IsSuccessStatusCode) throw new HttpRequestException("Announcement image storage rejected the upload.", null, response.StatusCode);
        return new(new Uri(client.BaseAddress!, $"/storage/v1/object/public/{path}").AbsoluteUri);
    }

    private async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try { return await client.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw new HttpRequestException("Announcement image storage timed out.");
        }
    }
}

public sealed class AnnouncementImageLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<Guid> limiter = PartitionedRateLimiter.Create<Guid, Guid>(id =>
        RateLimitPartition.GetFixedWindowLimiter(id, _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    public RateLimitLease TryAcquire(Guid id) => limiter.AttemptAcquire(id);
    public void Dispose() => limiter.Dispose();
}

public static partial class AnnouncementEndpoints
{
    private static async Task<IResult> UploadImageAsync(HttpContext context, IAnnouncementImageStorage storage,
        AnnouncementImageLimiter limiter, CancellationToken ct)
    {
        using var lease = limiter.TryAcquire(Admin(context).UserId);
        if (!lease.IsAcquired) return Results.Problem("Please wait a minute before uploading again.", statusCode: 429);
        if (context.Request.ContentLength > AnnouncementImages.MaxBytes) return ImageTooLarge();
        // Read at most limit + 1 bytes, including when Content-Length is absent or incorrect.
        using var body = new MemoryStream();
        var buffer = new byte[64 * 1024];
        while (true)
        {
            var count = await context.Request.Body.ReadAsync(buffer.AsMemory(0, Math.Min(buffer.Length, AnnouncementImages.MaxBytes + 1 - (int)body.Length)), ct);
            if (count == 0) break;
            body.Write(buffer, 0, count);
            if (body.Length > AnnouncementImages.MaxBytes) return ImageTooLarge();
        }
        var data = body.ToArray();
        var type = AnnouncementImages.Validate(data, context.Request.ContentType);
        if (type is null) return Invalid("image", "Choose a valid JPEG, PNG, WebP, or GIF (up to 5 MB, 8192 pixels per side, and 40 megapixels).");
        return Results.Json(await storage.UploadAsync(data, type, ct), statusCode: 201);
    }

    private static IResult ImageTooLarge() => Results.Problem("Images must be 5 MB or smaller.", statusCode: 413);
}
