using System.Net;
using System.Text.Json;
using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Announcements;
using Microsoft.Extensions.Options;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class AdminPortraitStorageTests
{
    [Fact]
    public async Task PortraitUsesDedicatedBucketWithoutOverwritingAndSupportsCleanup()
    {
        using var handler = new CaptureHandler();
        using var client = new HttpClient(handler) { BaseAddress = new Uri("https://staging.example/") };
        var storage = new SupabaseAdminPortraitStorage(client, Options.Create(new SupabaseOptions { ServiceRoleKey = "fake-test-key" }));
        var data = AnnouncementImageTests.Png;
        var result = await storage.UploadAsync("abc123.png", new(data, new AnnouncementImageType("image/png", "png")), CancellationToken.None);
        Assert.Equal("https://staging.example/storage/v1/object/public/character-portraits/abc123.png", result);
        Assert.Equal("/storage/v1/object/character-portraits/abc123.png", handler.Path);
        Assert.Equal(HttpMethod.Post, handler.Method);
        Assert.Equal("false", handler.Upsert);
        Assert.Equal("Bearer fake-test-key", handler.Authorization);
        Assert.Equal("image/png", handler.ContentType);
        Assert.Equal(data, handler.Body);
        await storage.DeleteAsync("abc123.png", CancellationToken.None);
        Assert.Equal(HttpMethod.Delete, handler.Method);
        Assert.Equal("/storage/v1/object/character-portraits", handler.Path);
        using var json = JsonDocument.Parse(handler.Body!);
        Assert.Equal("abc123.png", json.RootElement.GetProperty("prefixes")[0].GetString());
    }

    [Fact]
    public async Task PortraitRejectsUntrustedObjectPathsAndHidesUpstreamErrors()
    {
        using var handler = new CaptureHandler { Status = HttpStatusCode.Forbidden };
        using var client = new HttpClient(handler) { BaseAddress = new Uri("https://staging.example/") };
        var storage = new SupabaseAdminPortraitStorage(client, Options.Create(new SupabaseOptions { ServiceRoleKey = "fake-test-key" }));
        var portrait = new ValidatedAdminPortrait(AnnouncementImageTests.Png, new("image/png", "png"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => storage.UploadAsync("../other/image.png", portrait, CancellationToken.None));
        Assert.Equal(0, handler.Calls);
        var error = await Assert.ThrowsAsync<HttpRequestException>(() => storage.UploadAsync("abc.png", portrait, CancellationToken.None));
        Assert.DoesNotContain("upstream-private-details", error.Message);
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        public string? Path, Upsert, Authorization, ContentType;
        public HttpMethod? Method;
        public byte[]? Body;
        public int Calls;
        public HttpStatusCode Status = HttpStatusCode.OK;
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++; Path = request.RequestUri!.AbsolutePath; Method = request.Method;
            Upsert = request.Headers.TryGetValues("x-upsert", out var values) ? values.Single() : null;
            Authorization = request.Headers.Authorization?.ToString();
            ContentType = request.Content?.Headers.ContentType?.MediaType;
            Body = request.Content is null ? null : await request.Content.ReadAsByteArrayAsync(ct);
            return new HttpResponseMessage(Status) { Content = new StringContent("upstream-private-details") };
        }
    }
}
