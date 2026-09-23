using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Characterdle.Server.Features.EpisodeLadder;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class EpisodeLadderEndpointTests : IAsyncLifetime
{
    private static readonly Guid PlayerId = Guid.NewGuid();
    private readonly LadderStore _store = new();
    private readonly PremiumStub _premium = new();
    private readonly ProfileStub _profiles = new();
    private WebApplication _app = null!;
    private HttpClient _client = null!;
    private const string Root = "/api/universes/got/episode-ladder";

    public async Task InitializeAsync()
    {
        // No application startup, credentials, scheduler, or external databases run in these tests.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddHttpContextAccessor();
        builder.Services.AddScoped<ICurrentSupabaseUserAccessor, UserStub>();
        builder.Services.AddSingleton<IEpisodeLadderRepository>(_store);
        builder.Services.AddSingleton<IPremiumRepository>(_premium);
        builder.Services.AddSingleton<ILeaderboardRepository>(_profiles);
        builder.Services.AddSingleton<IDataProtectionProvider>(new EphemeralDataProtectionProvider());
        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddSingleton<RandomLadderSession>();
        _app = builder.Build();
        _app.MapEpisodeLadderEndpoints();
        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync() { _client.Dispose(); await _app.DisposeAsync(); }
    private void SignIn(string token = "player") => _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData("bad-token", HttpStatusCode.Unauthorized)]
    [InlineData("player", HttpStatusCode.Forbidden)]
    public async Task RandomRequiresVerifiedPremiumForReadsAndAttempts(string? token, HttpStatusCode expected)
    {
        if (token is not null) SignIn(token);
        Assert.Equal(expected, (await _client.GetAsync($"{Root}/random")).StatusCode);
        Assert.Equal(expected, (await _client.PostAsJsonAsync($"{Root}/random/attempts", new
            { roundToken = "fake", order = new[] { 1, 2, 3, 4, 5 }, isPremium = true })).StatusCode);
        Assert.Equal(0, _store.CatalogCalls);
    }

    [Fact]
    public async Task RandomReplaysWithoutLookingUpOrPersistingDailyGames()
    {
        SignIn(); _premium.Enabled = true;
        var response = await _client.GetAsync($"{Root}/random");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl!.NoStore);
        var round = (await response.Content.ReadFromJsonAsync<RandomLadderResponse>())!;
        Assert.Equal(0, round.Game.GameId);
        Assert.Null(round.Game.Solution);
        Assert.Equal(1, _store.CatalogCalls);
        for (var attempt = 0; attempt < 4; attempt++)
        {
            var posted = await _client.PostAsJsonAsync($"{Root}/random/attempts", new
                { roundToken = round.RoundToken, order = round.Game.InitialOrder, status = "won" });
            Assert.Equal(HttpStatusCode.OK, posted.StatusCode);
            round = (await posted.Content.ReadFromJsonAsync<RandomLadderResponse>())!;
            Assert.Equal(attempt + 1, round.Game.Attempts.Count);
        }
        Assert.Equal("lost", round.Game.Status);
        Assert.NotNull(round.Game.Solution);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"{Root}/random/attempts",
            new { roundToken = round.RoundToken, order = round.Game.InitialOrder })).StatusCode);
        Assert.Equal(0, _store.Calls);
        Assert.Equal(0, _store.PuzzleCalls);
        Assert.Equal(0, _store.SubmitCalls);
        Assert.Equal(0, _store.AttemptReads);
        Assert.Equal(0, _profiles.CallCount);
        Assert.Equal(1, _store.CatalogCalls);
    }

    [Fact]
    public async Task RandomRechecksPremiumWhenSubmittingAnExistingRound()
    {
        SignIn(); _premium.Enabled = true;
        var round = (await _client.GetFromJsonAsync<RandomLadderResponse>($"{Root}/random"))!;
        _premium.Enabled = false;
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.PostAsJsonAsync($"{Root}/random/attempts",
            new { roundToken = round.RoundToken, order = round.Game.InitialOrder })).StatusCode);
    }

    [Fact]
    public async Task RandomHandlesEmptyCatalogAndInvalidUniverse()
    {
        SignIn(); _premium.Enabled = true; _store.EmptyCatalog = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await _client.GetAsync($"{Root}/random")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/universes/other/episode-ladder/random")).StatusCode);
    }

    [Fact]
    public async Task GuestsCanPlayCurrentWithoutReceivingTheAnswer()
    {
        var response = await _client.GetAsync($"{Root}/current");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = (await response.Content.ReadFromJsonAsync<EpisodeLadderResponse>())!;
        Assert.Null(game.Solution);
        Assert.All(game.Events, entry => Assert.Null(entry.Episode));
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Contains("Authorization", response.Headers.Vary);
        var post = await _client.PostAsJsonAsync($"{Root}/50/attempts", new { attempts = new long[][] { [5, 4, 3, 2, 1] }, guestId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.OK, post.StatusCode);
        Assert.Null(_store.LastUser);
        Assert.Equal(0, _profiles.CallCount);
    }

    [Fact]
    public async Task GuestRestoreReconstructsFeedbackWithoutRecordingAnything()
    {
        var response = await _client.PostAsJsonAsync($"{Root}/50/restore", new { attempts = new long[][] { [5, 4, 3, 2, 1] } });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = (await response.Content.ReadFromJsonAsync<EpisodeLadderResponse>())!;
        Assert.Single(game.Attempts);
        Assert.Null(game.Solution);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Equal(0, _store.SubmitCalls);
        Assert.Equal(0, _store.AttemptReads);
        Assert.Equal(0, _profiles.CallCount);
    }

    [Fact]
    public async Task GuestRestoreValidatesOrdersAndDoesNotBypassArchiveAccess()
    {
        var invalid = await _client.PostAsJsonAsync($"{Root}/50/restore", new { attempts = new long[][] { [1, 1, 1, 1, 1] } });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        _store.ArchiveIndex = 4;
        var forbidden = await _client.PostAsJsonAsync($"{Root}/50/restore", new { attempts = new long[][] { [1, 2, 3, 4, 5] } });
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal(0, _store.SubmitCalls);
        Assert.Equal(0, _profiles.CallCount);
    }

    [Fact]
    public async Task GuestRestoreRejectsSignedInOrInvalidCredentials()
    {
        SignIn();
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"{Root}/50/restore", new { attempts = Array.Empty<long[]>() })).StatusCode);
        SignIn("bad-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync($"{Root}/50/restore", new { attempts = Array.Empty<long[]>() })).StatusCode);
        Assert.Equal(0, _store.SubmitCalls);
        Assert.Equal(0, _profiles.CallCount);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public async Task DailyAndRandomUseTheSelectedDifficulty(int difficulty)
    {
        SignIn(); _premium.Enabled = true;
        var daily = await _client.GetFromJsonAsync<EpisodeLadderResponse>($"{Root}/current?difficulty={difficulty}");
        Assert.Equal(difficulty, daily!.Difficulty);
        Assert.Equal(5, daily.Difficulties!.Count);
        var random = await _client.GetFromJsonAsync<RandomLadderResponse>($"{Root}/random?difficulty={difficulty}");
        Assert.Equal(difficulty, random!.Game.Difficulty);
        var posted = await _client.PostAsJsonAsync($"{Root}/50/attempts", new { difficulty, attempts = new long[][] { [1, 2, 3, 4, 5] } });
        Assert.Equal(difficulty, (await posted.Content.ReadFromJsonAsync<EpisodeLadderResponse>())!.Difficulty);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public async Task InvalidDifficultyCannotReadOrWritePuzzles(int difficulty)
    {
        SignIn(); _premium.Enabled = true;
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync($"{Root}/current?difficulty={difficulty}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.GetAsync($"{Root}/random?difficulty={difficulty}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"{Root}/50/attempts", new { difficulty, attempts = new long[][] { [1, 2, 3, 4, 5] } })).StatusCode);
        Assert.Equal(0, _store.PuzzleCalls);
        Assert.Equal(0, _store.SubmitCalls);
    }

    [Fact]
    public async Task InvalidTokenIsNeverTreatedAsAGuest()
    {
        SignIn("bad-token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.GetAsync($"{Root}/current")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync($"{Root}/50/attempts", new { attempts = new long[][] { [1, 2, 3, 4, 5] }, guestId = Guid.NewGuid() })).StatusCode);
        Assert.Equal(0, _store.Calls);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OldArchiveRequiresVerifiedPremiumForReadsAndWrites(bool authenticated)
    {
        if (authenticated) SignIn();
        _store.ArchiveIndex = 4;
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.GetAsync($"{Root}/50")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await _client.PostAsJsonAsync($"{Root}/50/attempts", new { attempts = new long[][] { [1, 2, 3, 4, 5] }, guestId = Guid.NewGuid(), isPremium = true })).StatusCode);
        Assert.Equal(0, _store.PuzzleCalls);
        if (authenticated)
        {
            _premium.Enabled = true;
            Assert.Equal(HttpStatusCode.OK, (await _client.GetAsync($"{Root}/50")).StatusCode);
            Assert.Equal(PlayerId, _premium.LastUser);
        }
    }

    [Fact]
    public async Task SignedInResultUsesTokenIdentityAndServerGrade()
    {
        SignIn();
        var response = await _client.PostAsJsonAsync($"{Root}/50/attempts", new
        {
            attempts = new long[][] { [5, 4, 3, 2, 1] }, userId = Guid.NewGuid(), status = "won", lockedPositions = new[] { 0, 1, 2, 3, 4 },
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var game = (await response.Content.ReadFromJsonAsync<EpisodeLadderResponse>())!;
        Assert.Equal("playing", game.Status);
        Assert.Equal(new[] { 2 }, game.LockedPositions);
        Assert.Equal(PlayerId, _store.LastUser);
        Assert.Equal(PlayerId, _profiles.LastUser);
    }

    [Fact]
    public async Task MovingLockedEventsAndInvalidHistoriesNeverReachPersistence()
    {
        SignIn();
        foreach (var attempts in new long[][][] { [[5, 4, 3, 2, 1], [3, 1, 2, 4, 5]], [[1, 2, 3, 4, 99]], [[1, 1, 2, 3, 4]], [[1, 2, 3]] })
            Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"{Root}/50/attempts", new { attempts })).StatusCode);
        Assert.Equal(0, _store.SubmitCalls);
        Assert.Equal(0, _profiles.CallCount);
    }

    [Fact]
    public async Task GuestMigrationRequiresAuthenticationAndAReplayedWin()
    {
        var win = new { attempts = new long[][] { [5, 4, 3, 2, 1], [1, 2, 3, 4, 5] } };
        Assert.Equal(HttpStatusCode.Unauthorized, (await _client.PostAsJsonAsync($"{Root}/50/import", win)).StatusCode);
        SignIn();
        Assert.Equal(HttpStatusCode.BadRequest, (await _client.PostAsJsonAsync($"{Root}/50/import", new { attempts = new long[][] { [5, 4, 3, 2, 1] } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await _client.PostAsJsonAsync($"{Root}/50/import", win)).StatusCode);
        Assert.True(_store.LastImport);
        Assert.Equal(PlayerId, _store.LastUser);
    }

    [Fact]
    public async Task SavedStateResumesAndConflictingTabsReceiveTheCurrentState()
    {
        SignIn();
        _store.Saved = [[5, 4, 3, 2, 1]];
        var game = await _client.GetFromJsonAsync<EpisodeLadderResponse>($"{Root}/current");
        Assert.Single(game!.Attempts);
        Assert.Equal(new LadderEpisodeResponse(1, 3, "Episode title 3"), game.Events.Single(e => e.Id == 3).Episode);
        Assert.All(game.Events.Where(e => e.Id != 3), entry => Assert.Null(entry.Episode));
        _store.Conflict = true;
        var response = await _client.PostAsJsonAsync($"{Root}/50/attempts", new { attempts = new long[][] { [1, 2, 3, 4, 5] } });
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("current", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OldCompletedDifficultiesRemainFinishedAndCannotAcceptAnotherAttempt(bool won)
    {
        SignIn(); _premium.Enabled = true; _store.ArchiveIndex = 90;
        _store.Saved = won ? [[1, 2, 3, 4, 5]]
            : Enumerable.Repeat(new long[] { 5, 4, 3, 2, 1 }, 4).ToArray();
        var game = await _client.GetFromJsonAsync<EpisodeLadderResponse>($"{Root}/50");
        Assert.Equal(won ? "won" : "lost", game!.Status);
        Assert.Equal(_store.Saved.Length, game.Attempts.Count);
        var response = await _client.PostAsJsonAsync($"{Root}/50/attempts",
            new { attempts = _store.Saved.Append(new long[] { 1, 2, 3, 4, 5 }).ToArray() });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, _store.SubmitCalls);
    }

    [Theory]
    [InlineData("/api/universes/other/episode-ladder/current")]
    [InlineData("/api/universes/got/episode-ladder/0")]
    public async Task InvalidUniverseOrGameIsNotFound(string path) => Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync(path)).StatusCode);

    private sealed class UserStub(IHttpContextAccessor context) : ICurrentSupabaseUserAccessor
    {
        public Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken cancellationToken) => Task.FromResult(
            context.HttpContext!.Request.Headers.Authorization == "Bearer player" ? new VerifiedSupabaseUser(PlayerId, "Player", "player@example.invalid", null) : null);
    }

    private sealed class LadderStore : IEpisodeLadderRepository
    {
        public int Calls, PuzzleCalls, SubmitCalls, ArchiveIndex, CatalogCalls, AttemptReads;
        public bool EmptyCatalog;
        public Guid? LastUser;
        public bool LastImport, Conflict;
        public long[][] Saved = [];
        public Task<LadderGameReference?> GetGameReferenceAsync(long? gameId, CancellationToken ct) { Calls++; return Task.FromResult<LadderGameReference?>(EpisodeLadderRulesTests.Puzzle(gameId ?? 50, ArchiveIndex).Game); }
        public Task<LadderPuzzle?> GetPuzzleAsync(LadderGameReference game, CancellationToken ct, int difficulty = 1) { PuzzleCalls++; return Task.FromResult<LadderPuzzle?>(EpisodeLadderRulesTests.Puzzle(game.Id, game.ArchiveIndex) with { Difficulty = difficulty }); }
        public Task<IReadOnlyList<LadderEvent>> GetEventCatalogAsync(CancellationToken ct)
        {
            CatalogCalls++;
            return Task.FromResult<IReadOnlyList<LadderEvent>>(EmptyCatalog ? [] : EpisodeLadderRulesTests.Catalog());
        }
        public Task<long[][]> GetAttemptsAsync(Guid userId, long gameId, CancellationToken ct, int difficulty = 1) { AttemptReads++; return Task.FromResult(Saved); }
        public Task<IReadOnlyList<string>> GetDifficultyStatesAsync(Guid userId, long gameId, CancellationToken ct) => Task.FromResult<IReadOnlyList<string>>(["playing", "pending", "pending", "pending", "pending"]);
        public Task<EpisodeLadderResponse> SubmitAsync(LadderPuzzle puzzle, Guid? userId, Guid? guestId, long[][] attempts, bool importGuest, CancellationToken ct)
        {
            SubmitCalls++; LastUser = userId; LastImport = importGuest;
            if (Conflict) throw new LadderConflictException(EpisodeLadderRules.Replay(puzzle, Saved));
            return Task.FromResult(EpisodeLadderRules.Replay(puzzle, attempts));
        }
    }

    private sealed class PremiumStub : IPremiumRepository
    {
        public bool Enabled;
        public Guid LastUser;
        public Task<PremiumAccessResponse> GetPremiumAccessAsync(Guid userId, CancellationToken ct)
        {
            LastUser = userId;
            return Task.FromResult(new PremiumAccessResponse(Enabled, null, null, null, null, null, null, null, false, null,
                Enabled, Enabled, Enabled, Enabled, Enabled, 3, Enabled, 1, 0, true));
        }
        public Task<PremiumStateResponse> GetPremiumStateAsync(Guid userId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> HasActiveSubscriptionAsync(Guid userId, CancellationToken ct) => throw new NotSupportedException();
    }

    private sealed class ProfileStub : ILeaderboardRepository
    {
        public int CallCount;
        public Guid LastUser;
        public Task EnsurePlayerProfileAsync(VerifiedSupabaseUser user, CancellationToken ct) { CallCount++; LastUser = user.UserId; return Task.CompletedTask; }
        public Task<bool> GameExistsAsync(UniverseDefinition universe, long gameId, CancellationToken ct) => throw new NotSupportedException();
        public Task<UniverseLeaderboardResponse> GetLeaderboardAsync(UniverseDefinition universe, Guid? userId, int limit, CancellationToken ct) => throw new NotSupportedException();
        public Task<UniverseStreakResponse> UpsertUniverseGameResultAsync(Guid userId, UniverseDefinition universe, long gameId, int guesses, int hints,
            string mode, string status, IReadOnlyList<long> ids, IReadOnlyList<string> keys, int attemptNumber, CancellationToken ct) => throw new NotSupportedException("Ladder must never use the Character/Quote result writer.");
    }
}
