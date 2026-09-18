using System.Buffers.Binary;
using System.Net;
using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Announcements;
using Microsoft.Extensions.Options;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class AnnouncementImageTests
{
    public static byte[] Png => Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6NnUAAAAASUVORK5CYII=");

    [Fact]
    public void SupportsRasterFormatsAndRejectsMalformedHeadersAndHugeDimensions()
    {
        Assert.Equal("png", AnnouncementImages.Validate(Png, "image/png")?.Extension);
        var gif = Convert.FromBase64String("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
        Assert.Equal("gif", AnnouncementImages.Validate(gif, "image/gif")?.Extension);
        // Minimal frame headers exercise type detection; no server-side image decoding is performed.
        byte[] jpeg = [0xff, 0xd8, 0xff, 0xc0, 0, 8, 8, 0, 1, 0, 1, 1, 0xff, 0xda, 0, 2, 0xff, 0xd9];
        Assert.Equal("jpg", AnnouncementImages.Validate(jpeg, "image/jpeg")?.Extension);
        byte[] webp = [.. "RIFF"u8, 22, 0, 0, 0, .. "WEBPVP8X"u8, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        Assert.Equal("webp", AnnouncementImages.Validate(webp, "image/webp")?.Extension);
        Assert.Null(AnnouncementImages.Validate(Png[..30], "image/png"));
        Assert.Null(AnnouncementImages.Validate(gif[..12], "image/gif"));
        Assert.Null(AnnouncementImages.Validate(jpeg[..10], "image/jpeg"));
        Assert.Null(AnnouncementImages.Validate(webp[..25], "image/webp"));
        var huge = Png;
        BinaryPrimitives.WriteUInt32BigEndian(huge.AsSpan(16), 100000);
        Assert.Null(AnnouncementImages.Validate(huge, "image/png"));
        Assert.Null(AnnouncementImages.Validate("<html><script>alert(1)</script>"u8, "image/png"));
        Assert.Null(AnnouncementImages.Validate(Png, "text/html"));
    }

    [Fact]
    public async Task StorageUsesBackendKeyUniqueNamesAndNeverOverwritesOrTrustsResponseUrls()
    {
        using var handler = new StorageHandler();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("https://storage.example") };
        var storage = new SupabaseAnnouncementImageStorage(client, Options.Create(new SupabaseOptions { ServiceRoleKey = "test-secret" }));
        var type = AnnouncementImages.Validate(Png, "image/png")!;
        var first = await storage.UploadAsync(Png, type, default);
        var second = await storage.UploadAsync(Png, type, default);
        Assert.NotEqual(first.Url, second.Url);
        Assert.StartsWith("https://storage.example/storage/v1/object/public/announcement-images/", first.Url);
        Assert.DoesNotContain("test-secret", first.Url);
        Assert.All(handler.Paths, path => Assert.Matches(@"^/storage/v1/object/announcement-images/[a-f0-9]{32}\.png$", path));
        handler.Fail = true;
        var error = await Assert.ThrowsAsync<HttpRequestException>(() => storage.UploadAsync(Png, type, default));
        Assert.DoesNotContain("private-storage-body", error.Message);
        Assert.DoesNotContain("test-secret", error.Message);
        handler.Timeout = true;
        Assert.Contains("timed out", (await Assert.ThrowsAsync<HttpRequestException>(() => storage.UploadAsync(Png, type, default))).Message);
    }

    private sealed class StorageHandler : HttpMessageHandler
    {
        public List<string> Paths = [];
        public bool Fail;
        public bool Timeout;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            if (Timeout) throw new TaskCanceledException();
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("Bearer test-secret", request.Headers.Authorization!.ToString());
            Assert.Equal("test-secret", request.Headers.GetValues("apikey").Single());
            Assert.Equal("false", request.Headers.GetValues("x-upsert").Single());
            Assert.Equal("image/png", request.Content!.Headers.ContentType!.MediaType);
            Assert.Equal(Png, await request.Content.ReadAsByteArrayAsync(ct));
            Paths.Add(request.RequestUri!.AbsolutePath);
            return new HttpResponseMessage(Fail ? HttpStatusCode.Forbidden : HttpStatusCode.OK)
            { Content = new StringContent(Fail ? "private-storage-body" : "{\"url\":\"https://untrusted.example\"}") };
        }
    }
}
