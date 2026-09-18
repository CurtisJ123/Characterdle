using System.Text.RegularExpressions;
using System.Threading.RateLimiting;
using System.Xml.Linq;
using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Infrastructure.Auth;

namespace Characterdle.Server.Features.Announcements;

public sealed class AnnouncementCommentLimiter : IDisposable
{
    private readonly PartitionedRateLimiter<Guid> limiter = PartitionedRateLimiter.Create<Guid, Guid>(id =>
        RateLimitPartition.GetFixedWindowLimiter(id, _ => new FixedWindowRateLimiterOptions
        { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    public RateLimitLease TryAcquire(Guid id) => limiter.AttemptAcquire(id);
    public void Dispose() => limiter.Dispose();
}

public static partial class AnnouncementEndpoints
{
    private const string AdminKey = "Characterdle.VerifiedAdmin";

    public static IEndpointRouteBuilder MapAnnouncementEndpoints(this IEndpointRouteBuilder app)
    {
        var updates = app.MapGroup("/api/updates").WithTags("Updates").AddEndpointFilter(SafeRequestAsync);
        updates.MapGet("/", async (int? page, IAnnouncementRepository repo, CancellationToken ct) =>
            ValidPage(page) ? Results.Ok(await repo.ListAsync(false, page ?? 1, ct)) : Invalid("page", "Page must be between 1 and 10000."));
        updates.MapGet("/by-slug/{slug}", async (string slug, IAnnouncementRepository repo, CancellationToken ct) =>
            await repo.GetAsync(slug, ct) is { } post ? Results.Ok(post) : Results.NotFound());
        updates.MapGet("/current", async (IAnnouncementRepository repo, CancellationToken ct) =>
            Results.Ok(new { post = await repo.LatestPublishedAsync(ct) }));
        updates.MapGet("/latest", async (IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct) =>
        {
            var post = await repo.LatestAsync(ct);
            var user = await auth.GetCurrentUserAsync(ct);
            var seen = post is not null && user is not null && await repo.HasSeenAsync(user.UserId, post.Id, ct);
            return Results.Ok(new { post, seen });
        });
        updates.MapPost("/{id:guid}/seen", (Guid id, IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct) =>
            MarkSeenAsync(id, false, repo, auth, ct));
        updates.MapPost("/{id:guid}/claim", (Guid id, IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct) =>
            MarkSeenAsync(id, true, repo, auth, ct));
        updates.MapGet("/{id:guid}/comments", async (Guid id, int? page, IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct) =>
        {
            if (!ValidPage(page)) return Invalid("page", "Page must be between 1 and 10000.");
            var user = await auth.GetCurrentUserAsync(ct);
            return await repo.CommentsAsync(id, user?.UserId, false, page ?? 1, ct) is { } result ? Results.Ok(result) : Results.NotFound();
        });
        updates.MapPost("/{id:guid}/comments", async (Guid id, PostAnnouncementCommentRequest request, IAnnouncementRepository repo,
            ICurrentSupabaseUserAccessor auth, AnnouncementCommentLimiter limiter, CancellationToken ct) =>
        {
            var user = await auth.GetCurrentUserAsync(ct);
            if (user is null) return Results.Unauthorized();
            if (!ValidComment(request.Body)) return Invalid("body", "Enter 1 to 300 characters without control characters.");
            using var lease = limiter.TryAcquire(user.UserId);
            if (!lease.IsAcquired) return Results.Problem("Please wait a minute before posting again.", statusCode: 429);
            return await repo.AddCommentAsync(id, user, request.Body.Trim(), ct) ? Results.StatusCode(201) : Results.NotFound();
        });
        updates.MapDelete("/comments/{id:guid}", async (Guid id, IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct) =>
        {
            var user = await auth.GetCurrentUserAsync(ct);
            if (user is null) return Results.Unauthorized();
            return await repo.DeleteCommentAsync(id, user.UserId, ct) ? Results.NoContent() : Results.NotFound();
        });
        updates.MapGet("/sitemap.xml", async (IAnnouncementRepository repo, CancellationToken ct) =>
        {
            XNamespace ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
            var posts = await repo.SitemapAsync(ct);
            var xml = new XDocument(new XElement(ns + "urlset", posts.Select(post => new XElement(ns + "url",
                new XElement(ns + "loc", $"https://characterdle.com/updates/{post.Slug}"),
                new XElement(ns + "lastmod", post.UpdatedAt.ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"))))));
            return Results.Text(xml.ToString(), "application/xml");
        });

        var admin = app.MapGroup("/api/admin").WithTags("Admin").AddEndpointFilter(SafeRequestAsync)
            .AddEndpointFilter(async (context, next) =>
            {
                var auth = context.HttpContext.RequestServices.GetRequiredService<ICurrentSupabaseUserAccessor>();
                var repo = context.HttpContext.RequestServices.GetRequiredService<IAnnouncementRepository>();
                var user = await auth.GetCurrentUserAsync(context.HttpContext.RequestAborted);
                if (user is null) return Results.Unauthorized();
                if (!await repo.IsAdminAsync(user.UserId, context.HttpContext.RequestAborted)) return Results.StatusCode(403);
                context.HttpContext.Items[AdminKey] = user;
                return await next(context);
            });
        admin.MapGet("/access", () => Results.Ok(new { isAdmin = true }));
        admin.MapAdminCatalogEndpoints();
        admin.MapPost("/updates/images", UploadImageAsync);
        admin.MapGet("/dashboard", async (IAdminDashboardRepository repo, CancellationToken ct) =>
            Results.Ok(await repo.GetAsync(ct)));
        admin.MapGet("/updates", async (int? page, IAnnouncementRepository repo, CancellationToken ct) =>
            ValidPage(page) ? Results.Ok(await repo.ListAsync(true, page ?? 1, ct)) : Invalid("page", "Invalid page."));
        admin.MapGet("/updates/{id:guid}", async (Guid id, IAnnouncementRepository repo, CancellationToken ct) =>
            await repo.GetAdminAsync(id, ct) is { } post ? Results.Ok(post) : Results.NotFound());
        admin.MapPost("/updates", (SaveAnnouncementRequest request, HttpContext context, IAnnouncementRepository repo, CancellationToken ct) =>
            SaveAsync(null, request, context, repo, ct));
        admin.MapPut("/updates/{id:guid}", (Guid id, SaveAnnouncementRequest request, HttpContext context, IAnnouncementRepository repo, CancellationToken ct) =>
            SaveAsync(id, request, context, repo, ct));
        admin.MapGet("/comments", async (int? page, Guid? postId, string? source, IAdminCommentsRepository repo, CancellationToken ct) =>
        {
            if (!ValidPage(page)) return Invalid("page", "Invalid page.");
            if (source is not (null or "all" or "updates" or "games")) return Invalid("source", "Choose all, updates, or games.");
            return Results.Ok(await repo.GetAsync(source ?? "all", postId, page ?? 1, ct));
        });
        admin.MapPut("/comments/{id:guid}", async (Guid id, ModerateAnnouncementCommentRequest request, HttpContext context, IAnnouncementRepository repo, CancellationToken ct) =>
            await repo.ModerateAsync(id, Admin(context).UserId, request.Hidden, ct) ? Results.NoContent() : Results.NotFound());
        return app;
    }

    private static VerifiedSupabaseUser Admin(HttpContext context) => (VerifiedSupabaseUser)context.Items[AdminKey]!;
    private static bool ValidPage(int? page) => page is null or >= 1 and <= 10000;
    private static IResult Invalid(string field, string message) => Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });
    public static bool ValidComment(string? body) => !string.IsNullOrWhiteSpace(body) && body.Length <= 300 && !HasInvalidControls(body);
    private static bool HasInvalidControls(string value) => value.Any(c => char.IsControl(c) && c is not '\n' and not '\r' and not '\t');

    private static async Task<IResult> MarkSeenAsync(Guid id, bool latestOnly, IAnnouncementRepository repo, ICurrentSupabaseUserAccessor auth, CancellationToken ct)
    {
        var user = await auth.GetCurrentUserAsync(ct);
        if (user is null) return Results.Unauthorized();
        var claimed = await repo.MarkSeenAsync(user.UserId, id, latestOnly, ct);
        return Results.Ok(new { claimed });
    }

    private static async Task<IResult> SaveAsync(Guid? id, SaveAnnouncementRequest request, HttpContext context, IAnnouncementRepository repo, CancellationToken ct)
    {
        if (request.Slug is null || request.Slug.Length > 160 || !SlugPattern().IsMatch(request.Slug)) return Invalid("slug", "Use lowercase words separated by hyphens for the URL.");
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 160 || HasInvalidControls(request.Title)) return Invalid("title", "Enter a title up to 160 characters.");
        if (request.Summary is null || request.Summary.Length > 600 || HasInvalidControls(request.Summary)) return Invalid("summary", "Summary must be at most 600 characters.");
        if (request.BodyMarkdown is null || request.BodyMarkdown.Length > 100000 || HasInvalidControls(request.BodyMarkdown)) return Invalid("bodyMarkdown", "Post must be at most 100,000 characters.");
        if (request.BodyMarkdown.Contains("announcement-image:", StringComparison.OrdinalIgnoreCase))
            return Invalid("bodyMarkdown", "Local image placeholders must be uploaded and resolved before saving the post.");
        if (request.Status is not ("draft" or "published")) return Invalid("status", "Choose draft or published.");
        if (request.Status == "published" && (string.IsNullOrWhiteSpace(request.Summary) || string.IsNullOrWhiteSpace(request.BodyMarkdown)))
            return Invalid("bodyMarkdown", "Add a summary and post content before publishing.");
        if (id is not null && request.ExpectedUpdatedAt is null) return Invalid("expectedUpdatedAt", "Reload this post before saving.");
        var result = await repo.SaveAsync(id, Admin(context).UserId, request, ct);
        return Results.Json(result, statusCode: id is null ? 201 : 200);
    }

    private static async ValueTask<object?> SafeRequestAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        context.HttpContext.Response.Headers.CacheControl = "private, no-store";
        context.HttpContext.Response.Headers.Vary = "Authorization";
        if (context.HttpContext.Request.Path.StartsWithSegments("/api/admin"))
            context.HttpContext.Response.Headers["X-Robots-Tag"] = "noindex, nofollow";
        try { return await next(context); }
        catch (AnnouncementConflictException ex) { return Results.Problem(ex.Message, statusCode: 409); }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            context.HttpContext.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Announcements")
                .LogError(ex, "Updates request failed.");
            return Results.Problem("Updates are temporarily unavailable. Please try again.", statusCode: 503);
        }
    }

    [GeneratedRegex("^[a-z0-9]+(-[a-z0-9]+)*\\z", RegexOptions.CultureInvariant)]
    private static partial Regex SlugPattern();
}
