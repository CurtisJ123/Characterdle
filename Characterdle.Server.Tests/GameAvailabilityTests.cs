using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class GameAvailabilityTests : IAsyncLifetime
{
    private readonly AvailabilityStore _store = new();
    private WebApplication _app = null!;
    private HttpClient _client = null!;

    public async Task InitializeAsync()
    {
        // Isolated TestServer: no application startup, credentials, or database connections.
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.Logging.ClearProviders();
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton(UniverseCatalog.CreateDefault());
        builder.Services.AddSingleton<IUniverseGameRepository>(_store);
        builder.Services.AddScoped<ICurrentSupabaseUserAccessor>(_ => throw new InvalidOperationException("Must not resolve auth."));
        builder.Services.AddScoped<IPremiumRepository>(_ => throw new InvalidOperationException("Must not resolve Premium."));
        _app = builder.Build();
        _app.MapUniverseGameEndpoints();
        await _app.StartAsync();
        _client = _app.GetTestClient();
    }

    public async Task DisposeAsync()
    {
        _client.Dispose();
        await _app.DisposeAsync();
    }

    [Theory]
    [InlineData("character", true)]
    [InlineData("quote", true)]
    [InlineData("character", false)]
    [InlineData("quote", false)]
    [InlineData("episode_ladder", true)]
    [InlineData("episode_ladder", false)]
    public async Task AnonymousReadReturnsOnlyAvailability(string mode, bool available)
    {
        _store.Available = available;
        var response = await _client.GetAsync($"/api/universes/got/games/50/availability/{mode}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Single(payload.EnumerateObject());
        Assert.Equal(available, payload.GetProperty("available").GetBoolean());
        Assert.Equal(("got", 50L, mode), _store.LastRequest);
        Assert.True(response.Headers.CacheControl!.NoStore);
    }

    [Theory]
    [InlineData("got", "0", "character")]
    [InlineData("got", "-1", "quote")]
    [InlineData("missing", "50", "character")]
    [InlineData("got", "50", "random")]
    [InlineData("got", "not-a-number", "quote")]
    public async Task InvalidScopeNeverQueriesDatabase(string universe, string id, string mode)
    {
        var response = await _client.GetAsync($"/api/universes/{universe}/games/{id}/availability/{mode}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, _store.Calls);
    }

    [Fact]
    public async Task DatabaseFailureIsRetryableAndDoesNotLeakDetails()
    {
        _store.Fail = true;
        var response = await _client.GetAsync("/api/universes/got/games/50/availability/character");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal(TimeSpan.FromSeconds(60), response.Headers.RetryAfter!.Delta);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.DoesNotContain("private-database-detail", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("character")]
    [InlineData("quote")]
    [InlineData("episode_ladder")]
    public void ExistenceQueryIsReadOnlyParameterizedAndExcludesFutureGames(string mode)
    {
        using var command = UniverseGameAvailabilityCommand.Create(UniverseCatalog.CreateDefault().Universes[0], 12345, mode);
        Assert.StartsWith("select exists", command.CommandText);
        Assert.Contains("games.id = @gameId", command.CommandText);
        Assert.Contains("games.datetime <= now()", command.CommandText);
        Assert.DoesNotContain("12345", command.CommandText);
        Assert.Equal(12345L, command.Parameters["gameId"].Value);
        Assert.Equal(mode == "quote", command.CommandText.Contains("quotes.id = games.quote_id"));
        Assert.DoesNotContain("quote_text", command.CommandText);
        Assert.DoesNotContain("display_name", command.CommandText);
        Assert.DoesNotContain("UserPremiumStatus", command.CommandText);
    }

    [Fact]
    public void InvalidModesCannotBecomeSql()
    {
        Assert.Throws<ArgumentException>(() => UniverseGameAvailabilityCommand.Create(
            UniverseCatalog.CreateDefault().Universes[0], 50, "quote'; drop table games; --"));
    }

    private sealed class AvailabilityStore : IUniverseGameRepository
    {
        public bool Available { get; set; }
        public bool Fail { get; set; }
        public int Calls { get; private set; }
        public (string, long, string) LastRequest { get; private set; }
        public Task<bool> IsGameAvailableAsync(UniverseDefinition universe, long gameId, string mode, CancellationToken cancellationToken)
        {
            Calls++;
            LastRequest = (universe.Id, gameId, mode);
            if (Fail) throw new InvalidOperationException("private-database-detail");
            return Task.FromResult(Available);
        }

        public Task<IReadOnlyList<UniverseCharacterAvatarOptionResponse>> GetCharacterAvatarOptionsAsync(UniverseDefinition universe, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CurrentUniverseGameResponse?> GetCurrentGameAsync(UniverseDefinition universe, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CurrentUniverseGameResponse?> GetGameByIdAsync(UniverseDefinition universe, long gameId, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<CurrentUniverseGameResponse?> GetRandomGameAsync(UniverseDefinition universe, string mode, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<bool> UpsertGamePlayAsync(UniverseDefinition universe, long gameId, string mode, string participantKey, int guessCount, int hintCount, string status, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<PreviousUniverseGamesResponse> GetPreviousGamesAsync(UniverseDefinition universe, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<DateTime?> GetMostRecentGameDateTimeUtcAsync(UniverseDefinition universe, CancellationToken cancellationToken) => throw new NotSupportedException();
        public Task<ScheduledUniverseGameCreationResult> CreateScheduledGameAsync(UniverseDefinition universe, DateTime scheduledAtUtc, string selectionSeed, CancellationToken cancellationToken) => throw new NotSupportedException();
    }
}
