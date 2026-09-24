using Characterdle.Server.Features.Announcements;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Admin;

public sealed record AdminComment(Guid Id, string Source, string ContextTitle, string ContextUrl,
    string DisplayName, string? AvatarUrl, string Body, DateTimeOffset CreatedAt, bool IsHidden, bool CanModerate);

public interface IAdminCommentsRepository
{
    Task<AnnouncementPage<AdminComment>> GetAsync(string source, Guid? postId, int page, CancellationToken ct);
}

public sealed class AdminCommentsRepository(NpgsqlDataSource dataSource) : IAdminCommentsRepository
{
    // Combine before sorting/paging, so every game mode shares the same newest-first timeline.
    internal const string Query = """
            with comments as (
              select c.id, 'update'::text as source, p.title as context_title, p.slug,
                null::text as universe_id, null::bigint as game_id, null::text as mode,
                c.user_id, c.body, c.created_at, c.hidden_at is not null as is_hidden
              from public."AnnouncementComments" c
              join public."Announcements" p on p.id = c.announcement_id
              where @source in ('all', 'updates') and (@post is null or p.id = @post)
              union all
              select c.id, 'game', null, null, c.universe_id, c.game_id, c.mode,
                c.user_id, c.body, c.created_at, false
              from public."UniverseGameComments" c
              where @source in ('all', 'games') and @post is null and c.mode in ('character', 'quote', 'episode_ladder')
            )
            select c.id, c.source, c.context_title, c.slug, c.universe_id, c.game_id, c.mode,
              coalesce(p.display_name, 'Deleted player'), p.avatar_url, c.body, c.created_at, c.is_hidden
            from comments c
            left join public."PlayerProfiles" p on p.user_id = c.user_id
            order by c.created_at desc, c.source asc, c.id desc
            offset @offset limit 6
            """;
    internal static string GameModeLabel(string mode) => mode switch
    {
        "quote" => "Quote",
        "episode_ladder" => "Episode Ladder",
        _ => "Character",
    };

    public async Task<AnnouncementPage<AdminComment>> GetAsync(string source, Guid? postId, int page, CancellationToken ct)
    {
        await using var cmd = dataSource.CreateCommand(Query);
        cmd.Parameters.AddWithValue("source", source);
        cmd.Parameters.AddWithValue("post", NpgsqlDbType.Uuid, (object?)postId ?? DBNull.Value);
        cmd.Parameters.AddWithValue("offset", ((long)page - 1) * 5);
        var items = new List<AdminComment>();
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var isUpdate = reader.GetString(1) == "update";
            var title = isUpdate ? reader.GetString(2)
                : $"{reader.GetString(4).ToUpperInvariant()} / {GameModeLabel(reader.GetString(6))} #{reader.GetInt64(5)}";
            var url = isUpdate ? $"/updates/{Uri.EscapeDataString(reader.GetString(3))}"
                : $"/{Uri.EscapeDataString(reader.GetString(4))}/game/{Uri.EscapeDataString(reader.GetString(6))}/{reader.GetInt64(5)}";
            var avatar = reader.IsDBNull(8) ? null : reader.GetString(8);
            var safeAvatar = avatar is not null && ((avatar.StartsWith("/images/", StringComparison.Ordinal) && !avatar.Contains('\\'))
                || (Uri.TryCreate(avatar, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps)) ? avatar : null;
            items.Add(new(reader.GetGuid(0), reader.GetString(1), title, url, reader.GetString(7),
                safeAvatar, reader.GetString(9), reader.GetFieldValue<DateTimeOffset>(10), reader.GetBoolean(11), isUpdate));
        }
        return new(items.Take(5).ToArray(), page, items.Count > 5);
    }
}
