using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class EpisodeLadderScoringTests
{
    [Theory]
    [InlineData(1, 10, 6, 4, 3)]
    [InlineData(2, 15, 9, 6, 4)]
    [InlineData(3, 20, 12, 8, 6)]
    [InlineData(4, 25, 15, 10, 7)]
    [InlineData(5, 30, 18, 12, 9)]
    public void FailedGuessesApplyFrontLoadedPenalties(int difficulty, params int[] expected)
    {
        for (var attempt = 1; attempt <= 4; attempt++)
        {
            Assert.Equal(expected[attempt - 1], EpisodeLadderScoring.Points(difficulty, "won", attempt));
            Assert.Equal(0, EpisodeLadderScoring.Points(difficulty, "lost", attempt));
            Assert.Equal(0, EpisodeLadderScoring.Points(difficulty, "playing", attempt));
        }
    }

    [Fact]
    public void DailyMaximumIsOneHundredAndSqlLookupMatchesScoring()
    {
        Assert.Equal(100, Enumerable.Range(1, 5).Sum(d => EpisodeLadderScoring.Points(d, "won", 1)));
        var table = EpisodeLadderScoring.ScoreTable();
        Assert.Equal(20, table.Length);
        for (var difficulty = 1; difficulty <= 5; difficulty++)
            for (var attempts = 1; attempts <= 4; attempts++)
                Assert.Equal(EpisodeLadderScoring.Points(difficulty, "won", attempts), table[(difficulty - 1) * 4 + attempts - 1]);
    }

    [Theory]
    [InlineData(11, 1, 6)]
    [InlineData(13, 2, 5)]
    [InlineData(11, 3, 3)]
    [InlineData(11, 4, 2)]
    [InlineData(11, 8, 0)]
    [InlineData(11, -1, 0)]
    [InlineData(-10, 1, 0)]
    public void FractionalScoresRoundDownAndCannotBecomeNegative(int basePoints, int failures, int expected) =>
        Assert.Equal(expected, EpisodeLadderScoring.AfterFailedGuesses(basePoints, failures));

    [Theory]
    [InlineData(0, 10)]
    [InlineData(1, 6)]
    [InlineData(2, 4)]
    [InlineData(3, 3)]
    [InlineData(4, 2)]
    public void PenaltyScheduleIncludesEightyPercentDeduction(int failures, int expected) =>
        Assert.Equal(expected, EpisodeLadderScoring.AfterFailedGuesses(10, failures));

    [Theory]
    [InlineData(0, 1)]
    [InlineData(6, 1)]
    [InlineData(1, 0)]
    [InlineData(1, 5)]
    public void InvalidResultsCannotEarnPoints(int difficulty, int attempts) =>
        Assert.Equal(0, EpisodeLadderScoring.Points(difficulty, "won", attempts));

    [Fact]
    public void QueryUsesEveryCompletedDifficultyButOnlyOneDayPerGame()
    {
        var sql = EpisodeLadderLeaderboardRepository.Query;
        Assert.Contains("public.\"GOTEpisodeLadderProgress\"", sql);
        Assert.DoesNotContain("UniverseGameResults", sql);
        Assert.Contains("progress.status in ('won', 'lost')", sql);
        Assert.Contains("count(distinct game_id)", sql);
        Assert.Contains("sum(points)", sql);
        Assert.Contains("when progress.status = 'won'", sql);
        Assert.Contains("else 0 end as points", sql);
        Assert.Contains("games.datetime <= now()", sql);
        Assert.DoesNotContain("games.datetime >=", sql); // No archive cutoff.
        Assert.DoesNotContain("updated_at", sql); // Playing three archived days today counts as three days.
        Assert.Contains("round(total_points::numeric / days_played, 2)", sql);
    }

    [Fact]
    public void RankingPrecedesLimitsAndPersonalLookupWithoutBreakingTies()
    {
        var sql = EpisodeLadderLeaderboardRepository.Query;
        Assert.Contains("dense_rank() over (order by total_points desc)", sql);
        Assert.Contains("select * from ranked where position <= @limit or user_id = @currentUserId", sql);
        Assert.Contains("row_number() over (order by total_points desc, display_name, user_id)", sql);
        Assert.DoesNotContain("insert ", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("update ", sql, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class EpisodeLadderLeaderboardEndpointTests : IAsyncLifetime
{
    private static readonly Guid PlayerId = Guid.NewGuid();
    private const string Url = "/api/universes/got/leaderboard/episode-ladder";
    private readonly Store _store = new();
    private WebApplication _app = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        // In-memory host only: no real startup, credentials, scheduler, or database.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentSupabaseUserAccessor, UserStub>();
        builder.Services.AddSingleton<IEpisodeLadderLeaderboardRepository>(_store);
        _app = builder.Build();
        _app.MapEpisodeLadderLeaderboardEndpoints();
        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync() { _client.Dispose(); await _app.DisposeAsync(); }

    [Fact]
    public async Task GuestCanReadButCannotChooseAnotherUsersPersonalStanding()
    {
        var response = await _client.GetAsync($"{Url}?userId={PlayerId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Null(_store.UserId);
        Assert.Equal(50, _store.Limit);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.True(response.Headers.CacheControl.Private);
        Assert.Contains("Authorization", response.Headers.Vary);
        Assert.Null((await response.Content.ReadFromJsonAsync<EpisodeLadderLeaderboardResponse>())!.CurrentUser);
    }

    [Fact]
    public async Task VerifiedAccountGetsItsOwnStanding()
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "player");
        var data = await _client.GetFromJsonAsync<EpisodeLadderLeaderboardResponse>(Url);
        Assert.Equal(PlayerId, _store.UserId);
        Assert.Equal(PlayerId, data!.CurrentUser!.UserId);
        Assert.True(data.CurrentUser.IsCurrentUser);
    }

    [Fact]
    public async Task InvalidCredentialsAreNotTreatedAsGuest()
    {
        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "invalid");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync(Url)).StatusCode);
        Assert.Equal(0, _store.Calls);
    }

    [Fact]
    public async Task UnsupportedUniversesAndWritesCannotUseThisEndpoint()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(Url.Replace("/got/", "/lotr/"))).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await _client.PostAsJsonAsync(Url, new { points = 9999 })).StatusCode);
        Assert.Equal(0, _store.Calls);
    }

    [Fact]
    public async Task DatabaseFailureReturnsGenericRetryableError()
    {
        _store.Fail = true;
        var response = await _client.GetAsync(Url);
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.DoesNotContain("sensitive test details", await response.Content.ReadAsStringAsync());
    }

    private sealed class UserStub(IHttpContextAccessor accessor) : ICurrentSupabaseUserAccessor
    {
        public Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken cancellationToken) =>
            Task.FromResult(accessor.HttpContext!.Request.Headers.Authorization == "Bearer player"
                ? new VerifiedSupabaseUser(PlayerId, "Player", "not-exposed@example.test", null) : null);
    }

    private sealed class Store : IEpisodeLadderLeaderboardRepository
    {
        public Guid? UserId;
        public int Limit;
        public int Calls;
        public bool Fail;
        public Task<EpisodeLadderLeaderboardResponse> GetAsync(Guid? currentUserId, int limit, CancellationToken cancellationToken)
        {
            Calls++; UserId = currentUserId; Limit = limit;
            if (Fail) throw new InvalidOperationException("sensitive test details");
            EpisodeLadderLeaderboardEntry? current = currentUserId.HasValue
                ? new(72, currentUserId.Value, "Player", null, false, 8, 1, 8, true) : null;
            return Task.FromResult(new EpisodeLadderLeaderboardResponse(new(0, 0, 0, 0), [], current));
        }
    }
}
