using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Announcements;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests : IAsyncLifetime
{
    private static readonly Guid AdminId = Guid.NewGuid(), PlayerId = Guid.NewGuid();
    private readonly Store store = new();
    private readonly DashboardStore dashboard = new();
    private readonly CommentsStore adminComments = new();
    private readonly ImageStorage images = new();
    private readonly CatalogStore catalog = new();
    private readonly CatalogCreator creator = new();
    private WebApplication app = null!;
    private HttpClient client = null!;
    public async Task InitializeAsync()
    {
        // Isolated feature host: never load live credentials or run application startup/schedulers.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.WebHost.UseTestServer();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentSupabaseUserAccessor, UserAccessor>();
        builder.Services.AddSingleton<IAnnouncementRepository>(store);
        builder.Services.AddSingleton<IAdminCommentsRepository>(adminComments);
        builder.Services.AddSingleton<IAdminDashboardRepository>(dashboard);
        builder.Services.AddSingleton<IAdminCatalogRepository>(catalog);
        builder.Services.AddSingleton<IAdminCatalogCreator>(creator);
        builder.Services.AddSingleton<AnnouncementCommentLimiter>();
        builder.Services.AddSingleton<AnnouncementImageLimiter>();
        builder.Services.AddSingleton<IAnnouncementImageStorage>(images);
        app = builder.Build(); app.MapAnnouncementEndpoints(); await app.StartAsync(); client = app.GetTestClient();
    }
    public async Task DisposeAsync() { client.Dispose(); await app.DisposeAsync(); }
    private void SignIn(string? token) => client.DefaultRequestHeaders.Authorization = token is null ? null : new AuthenticationHeaderValue("Bearer", token);
    private static SaveAnnouncementRequest Draft(string status = "draft") => new("new-update", "New update", "Summary", "## Hello", status, true, null);

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("invalid", HttpStatusCode.Unauthorized)]
    [InlineData("player", HttpStatusCode.Forbidden)]
    public async Task EveryAdminOperationRejectsNonAdmins(string? token, HttpStatusCode status)
    {
        SignIn(token);
        Assert.Equal(status, (await client.GetAsync("/api/admin/access")).StatusCode);
        Assert.Equal(status, (await client.GetAsync($"/api/admin/dashboard?userId={AdminId}&isAdmin=true")).StatusCode);
        Assert.Equal(status, (await client.GetAsync("/api/admin/updates")).StatusCode);
        Assert.Equal(status, (await client.GetAsync($"/api/admin/updates/{store.Hidden.Id}")).StatusCode);
        Assert.Equal(status, (await client.PostAsJsonAsync("/api/admin/updates", Draft())).StatusCode);
        Assert.Equal(status, (await client.PutAsJsonAsync($"/api/admin/updates/{store.Hidden.Id}", Draft())).StatusCode);
        Assert.Equal(status, (await client.GetAsync("/api/admin/comments")).StatusCode);
        Assert.Equal(status, (await client.PutAsJsonAsync($"/api/admin/comments/{Guid.NewGuid()}", new { hidden = true })).StatusCode);
        Assert.Equal(status, (await UploadImage(AnnouncementImageTests.Png, "image/png")).StatusCode);
        Assert.Equal(0, images.Writes);
        Assert.Equal(0, store.Writes);
        Assert.Equal(0, dashboard.Reads);
        Assert.Equal(0, adminComments.Reads);
    }

    [Fact]
    public async Task AdminCommentFeedIncludesGameContextWithoutExposingAccountIdentifiers()
    {
        SignIn("admin");
        var response = await client.GetAsync("/api/admin/comments");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var page = (await response.Content.ReadFromJsonAsync<AnnouncementPage<AdminComment>>())!;
        Assert.Equal("all", adminComments.Source);
        Assert.Equal(1, adminComments.Page);
        Assert.Contains(page.Items, item => item.Source == "game" && !item.CanModerate && item.ContextUrl == "/got/game/quote/50");
        Assert.Contains(page.Items, item => item.Source == "update" && item.CanModerate);
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.Contains("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("email", json);
        Assert.DoesNotContain("userId", json);
    }

    [Fact]
    public async Task AdminCommentFeedValidatesFiltersAndPaginationBeforeReading()
    {
        SignIn("admin");
        foreach (var query in new[] { "source=other", "source=all%27%3BDROP%20TABLE", "page=0", "page=10001" })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/admin/comments?{query}")).StatusCode);
        Assert.Equal(0, adminComments.Reads);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/admin/comments?source=games&page=2")).StatusCode);
        Assert.Equal("games", adminComments.Source);
        Assert.Equal(2, adminComments.Page);
        Assert.Equal(0, store.Writes);
    }

    [Fact]
    public async Task AdminCommentFailureDoesNotLeakDatabaseDetails()
    {
        SignIn("admin"); adminComments.Fail = true;
        var response = await client.GetAsync("/api/admin/comments");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("private-database-details", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ManualLatestPostCanDifferFromAutomaticPopupAndDoesNotRequireLogin()
    {
        store.Current = store.Published with { Id = Guid.NewGuid(), Title = "Newer silent update", ShowPopup = false };
        var current = await client.GetFromJsonAsync<LatestPost>("/api/updates/current");
        var automatic = await client.GetFromJsonAsync<LatestPost>("/api/updates/latest");
        Assert.Equal(store.Current, current!.Post);
        Assert.Equal(store.Published.Id, automatic!.Post!.Id);
        Assert.Equal(0, store.Writes);
        store.Current = null;
        Assert.Null((await client.GetFromJsonAsync<LatestPost>("/api/updates/current"))!.Post);
    }

    [Fact]
    public async Task DashboardReturnsOnlyAggregateCountsToVerifiedAdminsWithoutCaching()
    {
        SignIn("admin");
        var response = await client.GetAsync("/api/admin/dashboard");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(dashboard.Snapshot, await response.Content.ReadFromJsonAsync<AdminDashboardResponse>());
        Assert.Equal(1, dashboard.Reads);
        Assert.Equal(0, store.Writes);
        Assert.Contains("private", response.Headers.CacheControl!.ToString());
        Assert.Contains("no-store", response.Headers.CacheControl.ToString());
        Assert.Contains("Authorization", response.Headers.Vary);
        Assert.Contains("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("email", json);
        Assert.DoesNotContain("userId", json);
    }

    [Fact]
    public async Task DashboardFailureReturnsUnavailableInsteadOfZeroCountsOrDatabaseDetails()
    {
        SignIn("admin");
        dashboard.Fail = true;
        var response = await client.GetAsync("/api/admin/dashboard");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("private-database-details", json);
        Assert.DoesNotContain("profiles", json);
    }

    [Fact]
    public async Task PublicReadsExcludeDraftsAndTheirCommentsAndSitemapEntries()
    {
        var list = await client.GetFromJsonAsync<AnnouncementPage<Announcement>>("/api/updates");
        Assert.Single(list!.Items); Assert.Equal(store.Published.Id, list.Items[0].Id);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/updates/by-slug/{store.Hidden.Slug}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/api/updates/{store.Hidden.Id}/comments")).StatusCode);
        var xml = await client.GetStringAsync("/api/updates/sitemap.xml");
        Assert.Contains(store.Published.Slug, xml); Assert.DoesNotContain(store.Hidden.Slug, xml);
    }

    [Fact]
    public async Task AdminCanCreateAndUpdateUsingVerifiedIdentity()
    {
        SignIn("admin");
        var created = await client.PostAsJsonAsync("/api/admin/updates", new { slug = "new-update", title = "New", summary = "Summary", bodyMarkdown = "Body",
            status = "published", showPopup = true, userId = PlayerId, createdBy = PlayerId });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); Assert.Equal(AdminId, store.LastActor);
        var post = (await created.Content.ReadFromJsonAsync<Announcement>())!;
        var request = Draft() with { ExpectedUpdatedAt = post.UpdatedAt };
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/admin/updates/{post.Id}", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"/api/admin/updates/{post.Id}", Draft())).StatusCode);
        Assert.Contains("no-store", created.Headers.CacheControl!.ToString());
        Assert.Contains("noindex", created.Headers.GetValues("X-Robots-Tag").Single());
    }

    [Fact]
    public async Task ValidatesPublicationAndConflictWithoutLeakingDatabaseErrors()
    {
        SignIn("admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft("published") with { Summary = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft() with { Slug = "../secret" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft() with { Slug = "valid-slug\n" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft() with { Title = new string('x', 161) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft() with { BodyMarkdown = "\0" })).StatusCode);
        foreach (var status in new[] { "draft", "published" })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/admin/updates", Draft(status) with
            { BodyMarkdown = "![Local](announcement-image:11111111-1111-4111-8111-111111111111)" })).StatusCode);
        Assert.Equal(0, store.Writes);
        store.Conflict = true;
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/admin/updates", Draft())).StatusCode);
    }

    [Fact]
    public async Task ReceiptIsAuthenticatedIdempotentAndScopedToVerifiedUser()
    {
        var path = $"/api/updates/{store.Published.Id}/claim";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync(path, null)).StatusCode);
        SignIn("player");
        Assert.True((await (await client.PostAsJsonAsync(path, new { userId = AdminId })).Content.ReadFromJsonAsync<Claim>())!.Claimed);
        Assert.False((await (await client.PostAsync(path, null)).Content.ReadFromJsonAsync<Claim>())!.Claimed);
        Assert.Contains((PlayerId, store.Published.Id), store.Views);
        Assert.DoesNotContain((AdminId, store.Published.Id), store.Views);
        Assert.False((await (await client.PostAsync($"/api/updates/{store.Hidden.Id}/claim", null)).Content.ReadFromJsonAsync<Claim>())!.Claimed);
    }

    [Fact]
    public async Task CommentsRequireAuthValidateBodyAndEnforceOwnershipAndRateLimit()
    {
        var path = $"/api/updates/{store.Published.Id}/comments";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync(path, new { body = "hello" })).StatusCode);
        SignIn("player");
        foreach (var body in new[] { " ", "\0", new string('a', 301) })
            Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(path, new { body })).StatusCode);
        const string malicious = "<script>alert(1)</script> '; DROP TABLE users; --";
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync(path, new { body = malicious, userId = AdminId })).StatusCode);
        Assert.Equal(PlayerId, store.LastActor); Assert.Equal(malicious, store.LastBody);
        var id = store.Comments.Single().Key;
        SignIn("admin");
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"/api/updates/comments/{id}")).StatusCode);
        SignIn("player");
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/updates/comments/{id}")).StatusCode);
        for (var i = 0; i < 4; i++) Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync(path, new { body = "hello" })).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await client.PostAsJsonAsync(path, new { body = "hello" })).StatusCode);
    }

    [Fact]
    public async Task PaginationRejectsInvalidPagesAndModerationUsesAdminIdentity()
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/updates?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync($"/api/updates/{store.Published.Id}/comments?page=10001")).StatusCode);
        SignIn("admin");
        Assert.Equal(HttpStatusCode.NoContent, (await client.PutAsJsonAsync($"/api/admin/comments/{Guid.NewGuid()}", new { hidden = true, userId = PlayerId })).StatusCode);
        Assert.Equal(AdminId, store.LastActor);
    }

    private sealed record Claim(bool Claimed);
    private Task<HttpResponseMessage> UploadImage(byte[] data, string type)
    {
        var content = new ByteArrayContent(data);
        content.Headers.ContentType = new MediaTypeHeaderValue(type);
        return client.PostAsync("/api/admin/updates/images", content);
    }

    [Fact]
    public async Task ImageUploadRequiresValidRasterAndReturnsOnlyPublicUrl()
    {
        SignIn("admin");
        var response = await UploadImage(AnnouncementImageTests.Png, "image/png");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("png", images.Type!.Extension);
        Assert.Equal(AnnouncementImageTests.Png, images.Data);
        Assert.Equal("https://storage.example/image.png", (await response.Content.ReadFromJsonAsync<UploadedAnnouncementImage>())!.Url);
        Assert.Contains("no-store", response.Headers.CacheControl!.ToString());
        Assert.Contains("noindex", response.Headers.GetValues("X-Robots-Tag").Single());
        Assert.Equal(0, store.Writes);
    }

    [Fact]
    public async Task ImageUploadRejectsEmptyDisguisedMismatchedAndOversizedFiles()
    {
        SignIn("admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadImage([], "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadImage("<svg onload='alert(1)'/>"u8.ToArray(), "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadImage(AnnouncementImageTests.Png, "image/jpeg")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await UploadImage(AnnouncementImageTests.Png, "image/svg+xml")).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, (await UploadImage(new byte[AnnouncementImages.MaxBytes + 1], "image/png")).StatusCode);
        Assert.Equal(0, images.Writes);
    }

    [Fact]
    public async Task ChunkedImageUploadsCannotBypassSizeLimit()
    {
        SignIn("admin");
        using var content = new UnknownLengthContent(new byte[AnnouncementImages.MaxBytes + 1]);
        var response = await client.PostAsync("/api/admin/updates/images", content);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge, response.StatusCode);
        Assert.Equal(0, images.Writes);
    }

    [Fact]
    public async Task ImageStorageFailureIsGenericAndUploadsHaveTheirOwnRateLimit()
    {
        SignIn("admin"); images.Fail = true;
        var response = await UploadImage(AnnouncementImageTests.Png, "image/png");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("private-storage-details", await response.Content.ReadAsStringAsync());
        for (var i = 0; i < 9; i++) await UploadImage([], "image/png");
        Assert.Equal(HttpStatusCode.TooManyRequests, (await UploadImage([], "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync($"/api/updates/{store.Published.Id}/comments", new { body = "Still allowed" })).StatusCode);
    }

    private sealed class UnknownLengthContent(byte[] bytes) : HttpContent
    {
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => stream.WriteAsync(bytes).AsTask();
    }

    private sealed class ImageStorage : IAnnouncementImageStorage
    {
        public int Writes;
        public bool Fail;
        public byte[]? Data;
        public AnnouncementImageType? Type;
        public Task<UploadedAnnouncementImage> UploadAsync(byte[] data, AnnouncementImageType type, CancellationToken ct)
        {
            Writes++; Data = data; Type = type;
            if (Fail) throw new InvalidOperationException("private-storage-details");
            return Task.FromResult(new UploadedAnnouncementImage("https://storage.example/image.png"));
        }
    }
    private sealed record LatestPost(Announcement? Post);
    private sealed class CommentsStore : IAdminCommentsRepository
    {
        public int Reads, Page;
        public string? Source;
        public bool Fail;
        public Task<AnnouncementPage<AdminComment>> GetAsync(string source, Guid? postId, int page, CancellationToken ct)
        {
            Reads++; Source = source; Page = page;
            if (Fail) throw new InvalidOperationException("private-database-details");
            return Task.FromResult(new AnnouncementPage<AdminComment>([
                new(Guid.NewGuid(), "game", "GOT / Quote #50", "/got/game/quote/50", "Player", null, "A game comment", DateTimeOffset.UtcNow, false, false),
                new(Guid.NewGuid(), "update", "News", "/updates/news", "Player", null, "An update comment", DateTimeOffset.UtcNow.AddMinutes(-1), false, true)
            ], page, false));
        }
    }
    private sealed class DashboardStore : IAdminDashboardRepository
    {
        public int Reads;
        public bool Fail;
        public AdminDashboardResponse Snapshot = new(
            DateTimeOffset.Parse("2026-09-17T12:00:00Z"), DateTimeOffset.Parse("2026-09-10T12:00:00Z"),
            135, 10, 113, new(6, 4, 1, 1), new(228, 125, 456, 300));

        public Task<AdminDashboardResponse> GetAsync(CancellationToken ct)
        {
            Reads++;
            if (Fail) throw new InvalidOperationException("private-database-details");
            return Task.FromResult(Snapshot);
        }
    }

    private sealed class UserAccessor(IHttpContextAccessor context) : ICurrentSupabaseUserAccessor
    {
        public Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken ct)
        {
            var token = context.HttpContext?.Request.Headers.Authorization.ToString();
            return Task.FromResult(token == "Bearer admin" ? new VerifiedSupabaseUser(AdminId, "Admin", "admin@example.test", null)
                : token == "Bearer player" ? new VerifiedSupabaseUser(PlayerId, "Player", "player@example.test", null) : null);
        }
    }
    private sealed class Store : IAnnouncementRepository
    {
        public Announcement Published = new(Guid.NewGuid(), "public-update", "Public", "Summary", "Body", "published", true, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
        public Announcement Hidden = new(Guid.NewGuid(), "hidden-draft", "Draft", "", "", "draft", false, null, DateTimeOffset.UtcNow);
        public Announcement? Current;
        public HashSet<(Guid, Guid)> Views = [];
        public Dictionary<Guid, Guid> Comments = [];
        public Guid LastActor;
        public string? LastBody;
        public int Writes;
        public bool Conflict;
        public Task<bool> IsAdminAsync(Guid id, CancellationToken ct) => Task.FromResult(id == AdminId);
        public Task<AnnouncementPage<Announcement>> ListAsync(bool admin, int page, CancellationToken ct) => Task.FromResult(new AnnouncementPage<Announcement>(admin ? [Published, Hidden] : [Published], page, false));
        public Task<Announcement?> GetAsync(string slug, CancellationToken ct) => Task.FromResult(slug == Published.Slug ? Published : null);
        public Task<Announcement?> GetAdminAsync(Guid id, CancellationToken ct) => Task.FromResult<Announcement?>(id == Hidden.Id ? Hidden : Published);
        public Task<Announcement> SaveAsync(Guid? id, Guid actor, SaveAnnouncementRequest request, CancellationToken ct)
        {
            if (Conflict) throw new AnnouncementConflictException("Reload before saving.");
            LastActor = actor; Writes++; return Task.FromResult(Published);
        }
        public Task<Announcement?> LatestAsync(CancellationToken ct) => Task.FromResult<Announcement?>(Published);
        public Task<Announcement?> LatestPublishedAsync(CancellationToken ct) => Task.FromResult(Current);
        public Task<bool> HasSeenAsync(Guid user, Guid id, CancellationToken ct) => Task.FromResult(Views.Contains((user, id)));
        public Task<bool> MarkSeenAsync(Guid user, Guid id, bool latestOnly, CancellationToken ct) => Task.FromResult(id == Published.Id && Views.Add((user, id)));
        public Task<AnnouncementPage<AnnouncementComment>?> CommentsAsync(Guid? post, Guid? viewer, bool admin, int page, CancellationToken ct) =>
            Task.FromResult<AnnouncementPage<AnnouncementComment>?>(!admin && post == Hidden.Id ? null : new([], page, false));
        public Task<bool> AddCommentAsync(Guid post, VerifiedSupabaseUser user, string body, CancellationToken ct)
        {
            if (post != Published.Id) return Task.FromResult(false);
            Comments.Add(Guid.NewGuid(), user.UserId); LastActor = user.UserId; LastBody = body; Writes++; return Task.FromResult(true);
        }
        public Task<bool> DeleteCommentAsync(Guid id, Guid user, CancellationToken ct) => Task.FromResult(Comments.TryGetValue(id, out var owner) && owner == user && Comments.Remove(id));
        public Task<bool> ModerateAsync(Guid id, Guid actor, bool hidden, CancellationToken ct) { LastActor = actor; Writes++; return Task.FromResult(true); }
        public Task<IReadOnlyList<AnnouncementSitemapEntry>> SitemapAsync(CancellationToken ct) => Task.FromResult<IReadOnlyList<AnnouncementSitemapEntry>>([new(Published.Slug, Published.UpdatedAt)]);
    }
}
