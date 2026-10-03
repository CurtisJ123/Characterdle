using System.Net;
using System.Net.Http.Json;
using Characterdle.Server.Features.Admin;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests
{
    [Fact]
    public async Task LinkedGuestOnlyGetsCommentVisibilityNotOwnership()
    {
        client.DefaultRequestHeaders.Add("X-Leaderboard-Guest-Id", CommentViewerResolver.LinkedGuest.ToString());
        var response = await client.GetAsync($"/api/updates/{store.Published.Id}/comments?viewer_user_id={AdminId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(store.CommentViewer);
        Assert.Equal(CommentViewerResolver.LinkedUser, store.CommentVisibility);
        Assert.True(response.Headers.CacheControl!.Private);
        Assert.True(response.Headers.CacheControl.NoStore);
        Assert.Contains("Authorization", response.Headers.Vary);
        Assert.Contains("X-Leaderboard-Guest-Id", response.Headers.Vary);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync($"/api/updates/{store.Published.Id}/comments", new { body = "Not authorized" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.DeleteAsync($"/api/updates/comments/{Guid.NewGuid()}")).StatusCode);
    }

    [Fact]
    public async Task AuthenticatedCommentViewerTakesPriorityOverGuestAndQueryString()
    {
        SignIn("player");
        client.DefaultRequestHeaders.Add("X-Leaderboard-Guest-Id", CommentViewerResolver.LinkedGuest.ToString());
        var response = await client.GetAsync($"/api/updates/{store.Published.Id}/comments?viewer_user_id={AdminId}&admin=true");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(PlayerId, store.CommentViewer);
        Assert.Equal(PlayerId, store.CommentVisibility);
    }

    [Fact]
    public async Task InvalidAuthenticationCannotFallBackToLinkedGuestComments()
    {
        SignIn("invalid");
        client.DefaultRequestHeaders.Add("X-Leaderboard-Guest-Id", CommentViewerResolver.LinkedGuest.ToString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"/api/updates/{store.Published.Id}/comments")).StatusCode);
        Assert.Null(store.CommentVisibility);
    }

    [Fact]
    public async Task UnlinkedGuestHasNoCommentVisibilityException()
    {
        client.DefaultRequestHeaders.Add("X-Leaderboard-Guest-Id", Guid.NewGuid().ToString());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/updates/{store.Published.Id}/comments")).StatusCode);
        Assert.Null(store.CommentViewer);
        Assert.Null(store.CommentVisibility);
    }

    [Fact]
    public async Task CommentEligibilityFailureIsPrivateAndFailsClosed()
    {
        store.FailComments = true;
        var response = await client.GetAsync($"/api/updates/{store.Published.Id}/comments");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("private-moderation", await response.Content.ReadAsStringAsync());
        Assert.True(response.Headers.CacheControl!.NoStore);
    }

    [Fact]
    public void CommentAuthorRuleChecksActiveRestrictionsAndAllowsOnlyTheViewingAuthor()
    {
        var sql = PlayerModerationVisibility.VisibleAuthorSql("c.user_id", "@viewer");
        Assert.Contains("c.user_id = @viewer", sql);
        Assert.Contains("restriction.user_id = c.user_id", sql);
        Assert.Contains("restriction.state = 'shadow_banned'", sql);
        Assert.Contains("restriction.expires_at is null or restriction.expires_at > now()", sql);
    }
}
