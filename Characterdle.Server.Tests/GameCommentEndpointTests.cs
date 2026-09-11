using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Characterdle.Server.Features.GameComments;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class GameCommentEndpointTests : IAsyncLifetime
{
    private static readonly Guid PlayerId = Guid.NewGuid();
    private readonly CommentStore _store = new();
    private WebApplication _app = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        // Test only the mapped feature; never execute application startup or load Supabase credentials.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentSupabaseUserAccessor, TestUserAccessor>();
        builder.Services.AddSingleton(UniverseCatalog.CreateDefault());
        builder.Services.AddSingleton<IGameCommentRepository>(_store);
        _app = builder.Build();
        _app.MapGameCommentEndpoints();
        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _app.DisposeAsync();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("invalid-token")]
    public async Task AnonymousOrInvalidTokenCannotReadOrPost(string? token)
    {
        SignIn(token);
        var read = await _client.GetAsync(Url());
        var post = await _client.PostAsJsonAsync(Url(), new { body = "Hello" });
        Assert.Equal(HttpStatusCode.Unauthorized, read.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, post.StatusCode);
        Assert.Equal(0, _store.CallCount);
    }

    [Theory]
    [InlineData("character", 10)]
    [InlineData("quote", 10)]
    public async Task CompletionOfAnotherGameOrModeDoesNotGrantAccess(string mode, int gameId)
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 11, mode));
        _store.Completed.Add((PlayerId, gameId, mode == "quote" ? "character" : "quote"));
        _store.Completed.Add((Guid.NewGuid(), gameId, mode));
        var read = await _client.GetAsync(Url(gameId, mode));
        var post = await _client.PostAsJsonAsync(Url(gameId, mode), new { body = "Spoiler" });
        Assert.Equal(HttpStatusCode.Forbidden, read.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, post.StatusCode);
        Assert.Empty(_store.Comments);
    }

    [Theory]
    [InlineData("character")]
    [InlineData("quote")]
    public async Task PostUsesTokenIdentityAndReturnsPrivateResponse(string mode)
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 10, mode));
        var response = await _client.PostAsJsonAsync(Url(mode: mode), new
        {
            body = "  Hello\r\nworld  ", userId = Guid.NewGuid(), displayName = "Impersonated", isCompleted = true,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(PlayerId, _store.LastUserId);
        Assert.Equal("got", _store.LastUniverseId);
        var comment = await response.Content.ReadFromJsonAsync<GameCommentResponse>();
        Assert.Equal("Hello\nworld", comment!.Body);
        Assert.Equal("Player", comment.DisplayName);
        Assert.True(comment.ShowSupporterBadge);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.True(response.Headers.CacheControl.Private);
        Assert.Contains("Authorization", response.Headers.Vary);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n\t ")]
    [InlineData("Bad\u0000text")]
    [InlineData("Bad\u0007text")]
    public async Task InvalidTextIsRejected(string? text)
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 10, "character"));
        var response = await _client.PostAsJsonAsync(Url(), new { body = text });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _store.CallCount);
    }

    [Fact]
    public async Task EnforcesCharacterLimitIncludingSupplementaryUnicode()
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 10, "character"));
        Assert.Equal(HttpStatusCode.Created, (await _client.PostAsJsonAsync(Url(), new { body = new string('a', 300) })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(Url(), new { body = new string('a', 301) })).StatusCode);
        var emoji = string.Concat(Enumerable.Repeat(char.ConvertFromUtf32(0x1F409), 151));
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync(Url(), new { body = emoji })).StatusCode);
    }

    [Fact]
    public async Task HtmlAndSqlArePassedAsPlainText()
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 10, "character"));
        const string text = "<img src=x onerror=alert(1)> '; DROP TABLE users; --";
        var response = await _client.PostAsJsonAsync(Url(), new { body = text });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(text, (await response.Content.ReadFromJsonAsync<GameCommentResponse>())!.Body);
    }

    [Fact]
    public async Task PaginationUsesRequestedPageAndContainsOnlyFiveEntries()
    {
        SignIn("player");
        _store.Completed.Add((PlayerId, 10, "character"));
        for (var i = 0; i < 6; i++)
        {
            await _client.PostAsJsonAsync(Url(), new { body = $"Comment {i}" });
        }

        var page1 = await _client.GetFromJsonAsync<GameCommentsPageResponse>(Url());
        var page2 = await _client.GetFromJsonAsync<GameCommentsPageResponse>(Url() + "?page=2");
        Assert.Equal(5, page1!.Comments.Count);
        Assert.True(page1.HasNextPage);
        Assert.Single(page2!.Comments);
        Assert.False(page2.HasNextPage);
        Assert.Equal("Comment 0", page1.Comments[0].Body);
        Assert.Equal("Comment 5", page2.Comments[0].Body);
    }

    [Theory]
    [InlineData("?page=0")]
    [InlineData("?page=-1")]
    [InlineData("?page=abc")]
    [InlineData("?page=2147483648")]
    public async Task InvalidPagesAreRejected(string query)
    {
        SignIn("player");
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync(Url() + query)).StatusCode);
        Assert.Equal(0, _store.CallCount);
    }

    [Theory]
    [InlineData("/api/universes/got/games/0/character/comments/")]
    [InlineData("/api/universes/got/games/10/random/comments/")]
    [InlineData("/api/universes/missing/games/10/character/comments/")]
    public async Task InvalidGameScopeIsRejected(string url)
    {
        SignIn("player");
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(url)).StatusCode);
        Assert.Equal(0, _store.CallCount);
    }

    private void SignIn(string? token) => _client.DefaultRequestHeaders.Authorization = token is null
        ? null : new AuthenticationHeaderValue("Bearer", token);

    private static string Url(int id = 10, string mode = "character") => $"/api/universes/got/games/{id}/{mode}/comments/";

    private sealed class TestUserAccessor(IHttpContextAccessor context) : ICurrentSupabaseUserAccessor
    {
        public Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken cancellationToken) => Task.FromResult(
            context.HttpContext!.Request.Headers.Authorization == "Bearer player"
                ? new VerifiedSupabaseUser(PlayerId, "Player", "test@example.invalid", null)
                : null);
    }

    private sealed class CommentStore : IGameCommentRepository
    {
        public HashSet<(Guid UserId, long GameId, string Mode)> Completed { get; } = [];
        public List<GameCommentResponse> Comments { get; } = [];
        public Guid LastUserId { get; private set; }
        public string? LastUniverseId { get; private set; }
        public int CallCount { get; private set; }

        public Task<GameCommentsPageResponse?> GetPageAsync(Guid userId, UniverseDefinition universe, long gameId,
            string mode, int page, CancellationToken cancellationToken)
        {
            CallCount++;
            return Task.FromResult(Completed.Contains((userId, gameId, mode))
                ? new GameCommentsPageResponse(Comments.Skip((page - 1) * 5).Take(5).ToArray(), page, Comments.Count > page * 5)
                : null);
        }

        public Task<GameCommentResponse?> CreateAsync(Guid userId, UniverseDefinition universe, long gameId,
            string mode, string body, CancellationToken cancellationToken)
        {
            CallCount++;
            LastUserId = userId;
            LastUniverseId = universe.Id;
            if (!Completed.Contains((userId, gameId, mode)))
            {
                return Task.FromResult<GameCommentResponse?>(null);
            }
            var comment = new GameCommentResponse(Guid.NewGuid(), "Player", null, true, body, DateTimeOffset.UtcNow);
            Comments.Add(comment);
            return Task.FromResult<GameCommentResponse?>(comment);
        }
    }
}
