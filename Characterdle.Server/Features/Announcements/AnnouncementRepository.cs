using Characterdle.Server.Features.Leaderboard;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Announcements;

public sealed class AnnouncementRepository(NpgsqlDataSource dataSource) : IAnnouncementRepository
{
    private const string Columns = "id, slug, title, summary, body_markdown, status, show_popup, published_at, updated_at";
    private const string PublicPost = "status = 'published' and published_at <= now()";

    public async Task<bool> IsAdminAsync(Guid userId, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("select exists(select 1 from public.\"AdminUsers\" where user_id = @user)");
        cmd.Parameters.AddWithValue("user", userId);
        return await cmd.ExecuteScalarAsync(ct) is true;
    }

    public async Task<AnnouncementPage<Announcement>> ListAsync(bool admin, int page, CancellationToken ct)
    {
        // The predicate is a server constant, never a client-supplied SQL fragment.
        await using var cmd = dataSource.CreateCommand($"""
            select {Columns} from public."Announcements"
            where {(admin ? "true" : PublicPost)}
            order by coalesce(published_at, created_at) desc, id desc offset @offset limit 11
            """);
        cmd.Parameters.AddWithValue("offset", ((long)page - 1) * 10);
        var items = await ReadPostsAsync(cmd, ct);
        return new(items.Take(10).ToArray(), page, items.Count > 10);
    }

    public async Task<Announcement?> GetAsync(string slug, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"select {Columns} from public.\"Announcements\" where slug = @slug and {PublicPost}");
        cmd.Parameters.AddWithValue("slug", slug);
        return (await ReadPostsAsync(cmd, ct)).FirstOrDefault();
    }

    public async Task<Announcement?> GetAdminAsync(Guid id, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"select {Columns} from public.\"Announcements\" where id = @id");
        cmd.Parameters.AddWithValue("id", id);
        return (await ReadPostsAsync(cmd, ct)).FirstOrDefault();
    }

    public async Task<Announcement> SaveAsync(Guid? id, Guid adminId, SaveAnnouncementRequest request, CancellationToken ct)
    {
        var sql = id is null
            ? $"""
                insert into public."Announcements" (slug, title, summary, body_markdown, status, show_popup, created_by, updated_by)
                values (@slug, @title, @summary, @body, @status, @popup, @admin, @admin) returning {Columns}
                """
            : $"""
                update public."Announcements" set slug = @slug, title = @title, summary = @summary,
                  body_markdown = @body, status = @status, show_popup = @popup, updated_by = @admin
                where id = @id and updated_at = @expected
                  and (published_at is null or slug = @slug)
                returning {Columns}
                """;
        await using var cmd = dataSource.CreateCommand(sql);
        cmd.Parameters.AddWithValue("slug", request.Slug);
        cmd.Parameters.AddWithValue("title", request.Title.Trim());
        cmd.Parameters.AddWithValue("summary", request.Summary.Trim());
        cmd.Parameters.AddWithValue("body", request.BodyMarkdown);
        cmd.Parameters.AddWithValue("status", request.Status);
        cmd.Parameters.AddWithValue("popup", request.ShowPopup);
        cmd.Parameters.AddWithValue("admin", adminId);
        if (id is not null)
        {
            cmd.Parameters.AddWithValue("id", id.Value);
            cmd.Parameters.AddWithValue("expected", NpgsqlDbType.TimestampTz, (object?)request.ExpectedUpdatedAt?.ToUniversalTime() ?? DBNull.Value);
        }
        try
        {
            return (await ReadPostsAsync(cmd, ct)).FirstOrDefault()
                ?? throw new AnnouncementConflictException("This post changed in another session, or its published slug was changed. Reload before saving.");
        }
        catch (PostgresException ex) when (ex.SqlState == PostgresErrorCodes.UniqueViolation)
        {
            throw new AnnouncementConflictException("That URL slug is already used by another post.");
        }
    }

    public Task<Announcement?> LatestAsync(CancellationToken ct) => ReadLatestAsync(true, ct);
    public Task<Announcement?> LatestPublishedAsync(CancellationToken ct) => ReadLatestAsync(false, ct);

    private async Task<Announcement?> ReadLatestAsync(bool popupOnly, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"""
            select {Columns} from public."Announcements" where {PublicPost} and (not @popupOnly or show_popup)
            order by published_at desc, id desc limit 1
            """);
        cmd.Parameters.AddWithValue("popupOnly", popupOnly);
        return (await ReadPostsAsync(cmd, ct)).FirstOrDefault();
    }

    public async Task<bool> HasSeenAsync(Guid userId, Guid id, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            select exists(select 1 from public."UserAnnouncementViews" where user_id = @user and announcement_id = @id)
            """);
        cmd.Parameters.AddWithValue("user", userId);
        cmd.Parameters.AddWithValue("id", id);
        return await cmd.ExecuteScalarAsync(ct) is true;
    }

    public async Task<bool> MarkSeenAsync(Guid userId, Guid id, bool latestOnly, CancellationToken ct)
    {
        // A unique receipt atomically prevents two signed-in tabs/devices claiming the same popup.
        await using var cmd = dataSource.CreateCommand($"""
            insert into public."UserAnnouncementViews" (user_id, announcement_id)
            select @user, id from public."Announcements"
            where id = @id and {PublicPost}
              and (not @latestOnly or id = (
                select id from public."Announcements" where {PublicPost} and show_popup
                order by published_at desc, id desc limit 1))
            on conflict (user_id, announcement_id) do nothing returning announcement_id
            """);
        cmd.Parameters.AddWithValue("user", userId);
        cmd.Parameters.AddWithValue("id", id);
        cmd.Parameters.AddWithValue("latestOnly", latestOnly);
        return await cmd.ExecuteScalarAsync(ct) is Guid;
    }

    public async Task<AnnouncementPage<AnnouncementComment>?> CommentsAsync(Guid? postId, Guid? viewer, bool admin, int page, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            with visible_posts as (
              select id, title, slug from public."Announcements"
              where (@admin or (status = 'published' and published_at <= now()))
                and (@post is null or id = @post)
            )
            select c.id, c.announcement_id, p.title, p.slug, profiles.display_name, profiles.avatar_url,
              coalesce(premium.is_premium, false) and (premium.current_period_end is null or premium.current_period_end > now()),
              c.body, c.created_at, coalesce(c.user_id = @viewer, false), c.hidden_at is not null
            from public."AnnouncementComments" c
            join visible_posts p on p.id = c.announcement_id
            join public."PlayerProfiles" profiles on profiles.user_id = c.user_id
            left join public."UserPremiumStatus" premium on premium.user_id = c.user_id
            where @admin or c.hidden_at is null
            order by c.created_at asc, c.id asc offset @offset limit 6
            """);
        cmd.Parameters.AddWithValue("admin", admin);
        cmd.Parameters.AddWithValue("post", NpgsqlDbType.Uuid, (object?)postId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("viewer", NpgsqlDbType.Uuid, (object?)viewer ?? DBNull.Value);
        cmd.Parameters.AddWithValue("offset", ((long)page - 1) * 5);
        var items = new List<AnnouncementComment>();
        await using (var reader = await cmd.ExecuteReaderAsync(ct))
        {
            while (await reader.ReadAsync(ct))
            {
                var avatar = reader.IsDBNull(5) ? null : reader.GetString(5);
                var safeAvatar = avatar is not null && ((avatar.StartsWith("/images/", StringComparison.Ordinal) && !avatar.Contains('\\'))
                    || (Uri.TryCreate(avatar, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)) ? avatar : null;
                items.Add(new(reader.GetGuid(0), reader.GetGuid(1), reader.GetString(2), reader.GetString(3),
                    reader.GetString(4), safeAvatar, reader.GetBoolean(6), reader.GetString(7),
                    reader.GetFieldValue<DateTimeOffset>(8), reader.GetBoolean(9), reader.GetBoolean(10)));
            }
        }
        // Distinguish an empty comment list from an inaccessible/unpublished post.
        if (!admin && postId is not null)
        {
            await using var exists = dataSource.CreateCommand($"select exists(select 1 from public.\"Announcements\" where id = @id and {PublicPost})");
            exists.Parameters.AddWithValue("id", postId.Value);
            if (await exists.ExecuteScalarAsync(ct) is not true) return null;
        }
        return new(items.Take(5).ToArray(), page, items.Count > 5);
    }

    public async Task<bool> AddCommentAsync(Guid postId, VerifiedSupabaseUser user, string body, CancellationToken ct)
    {
        await using var connection = await dataSource.OpenConnectionAsync(ct);
        await using var transaction = await connection.BeginTransactionAsync(ct);
        // Lock the post against concurrent unpublishing while accepting the comment.
        await using var post = new NpgsqlCommand($"select id from public.\"Announcements\" where id = @id and {PublicPost} for share", connection, transaction);
        post.Parameters.AddWithValue("id", postId);
        if (await post.ExecuteScalarAsync(ct) is not Guid) return false;
        await using var cmd = new NpgsqlCommand("""
            insert into public."PlayerProfiles" (user_id, display_name, email, avatar_url)
            values (@user, @name, @email, @avatar) on conflict (user_id) do nothing;
            insert into public."AnnouncementComments" (announcement_id, user_id, body) values (@post, @user, @body);
            """, connection, transaction);
        cmd.Parameters.AddWithValue("post", postId);
        cmd.Parameters.AddWithValue("user", user.UserId);
        cmd.Parameters.AddWithValue("name", user.DisplayName);
        cmd.Parameters.AddWithValue("email", user.Email);
        cmd.Parameters.AddWithValue("avatar", NpgsqlDbType.Text, (object?)user.AvatarUrl ?? DBNull.Value);
        cmd.Parameters.AddWithValue("body", body);
        await cmd.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
        return true;
    }

    public async Task<bool> DeleteCommentAsync(Guid commentId, Guid userId, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("delete from public.\"AnnouncementComments\" where id = @id and user_id = @user");
        cmd.Parameters.AddWithValue("id", commentId);
        cmd.Parameters.AddWithValue("user", userId);
        return await cmd.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<bool> ModerateAsync(Guid commentId, Guid adminId, bool hidden, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand("""
            update public."AnnouncementComments" set hidden_at = case when @hidden then now() else null end,
              hidden_by = case when @hidden then @admin else null end where id = @id
            """);
        cmd.Parameters.AddWithValue("id", commentId);
        cmd.Parameters.AddWithValue("admin", adminId);
        cmd.Parameters.AddWithValue("hidden", hidden);
        return await cmd.ExecuteNonQueryAsync(ct) == 1;
    }

    public async Task<IReadOnlyList<AnnouncementSitemapEntry>> SitemapAsync(CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand($"select slug, updated_at from public.\"Announcements\" where {PublicPost} order by published_at desc, id desc limit 50000");
        var entries = new List<AnnouncementSitemapEntry>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) entries.Add(new(reader.GetString(0), reader.GetFieldValue<DateTimeOffset>(1)));
        return entries;
    }

    private static async Task<List<Announcement>> ReadPostsAsync(NpgsqlCommand cmd, CancellationToken ct)
    {
        var rows = new List<Announcement>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            rows.Add(new(reader.GetGuid(0), reader.GetString(1), reader.GetString(2), reader.GetString(3), reader.GetString(4),
                reader.GetString(5), reader.GetBoolean(6), reader.IsDBNull(7) ? null : reader.GetFieldValue<DateTimeOffset>(7),
                reader.GetFieldValue<DateTimeOffset>(8)));
        return rows;
    }
}
