namespace Characterdle.Server.Features.Admin;

internal static class PlayerModerationVisibility
{
    // SQL expressions are supplied by repositories, never by request data.
    internal static string VisibleAuthorSql(string author, string viewer) => $"""
        ({author} = {viewer} or not exists (
          select 1 from public."PlayerModeration" restriction
          where restriction.user_id = {author} and restriction.state = 'shadow_banned'
            and (restriction.expires_at is null or restriction.expires_at > now())
        ))
        """;
}
