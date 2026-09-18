using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Features.Announcements;

public sealed record Announcement(Guid Id, string Slug, string Title, string Summary, string BodyMarkdown,
    string Status, bool ShowPopup, DateTimeOffset? PublishedAt, DateTimeOffset UpdatedAt);
public sealed record AnnouncementPage<T>(IReadOnlyList<T> Items, int Page, bool HasNextPage);
public sealed record AnnouncementSitemapEntry(string Slug, DateTimeOffset UpdatedAt);
public sealed record SaveAnnouncementRequest(string Slug, string Title, string Summary, string BodyMarkdown,
    string Status, bool ShowPopup, DateTimeOffset? ExpectedUpdatedAt);
public sealed record AnnouncementComment(Guid Id, Guid AnnouncementId, string PostTitle, string PostSlug,
    string DisplayName, string? AvatarUrl, bool ShowSupporterBadge, string Body, DateTimeOffset CreatedAt,
    bool IsOwn, bool IsHidden);
public sealed record PostAnnouncementCommentRequest(string Body);
public sealed record ModerateAnnouncementCommentRequest(bool Hidden);

public interface IAnnouncementRepository
{
    Task<bool> IsAdminAsync(Guid userId, CancellationToken ct);
    Task<AnnouncementPage<Announcement>> ListAsync(bool admin, int page, CancellationToken ct);
    Task<Announcement?> GetAsync(string slug, CancellationToken ct);
    Task<Announcement?> GetAdminAsync(Guid id, CancellationToken ct);
    Task<Announcement> SaveAsync(Guid? id, Guid adminId, SaveAnnouncementRequest request, CancellationToken ct);
    Task<Announcement?> LatestAsync(CancellationToken ct);
    Task<Announcement?> LatestPublishedAsync(CancellationToken ct);
    Task<bool> HasSeenAsync(Guid userId, Guid id, CancellationToken ct);
    Task<bool> MarkSeenAsync(Guid userId, Guid id, bool latestOnly, CancellationToken ct);
    Task<AnnouncementPage<AnnouncementComment>?> CommentsAsync(Guid? postId, Guid? viewer, bool admin, int page, CancellationToken ct);
    Task<bool> AddCommentAsync(Guid postId, VerifiedSupabaseUser user, string body, CancellationToken ct);
    Task<bool> DeleteCommentAsync(Guid commentId, Guid userId, CancellationToken ct);
    Task<bool> ModerateAsync(Guid commentId, Guid adminId, bool hidden, CancellationToken ct);
    Task<IReadOnlyList<AnnouncementSitemapEntry>> SitemapAsync(CancellationToken ct);
}

public sealed class AnnouncementConflictException(string message) : Exception(message);
