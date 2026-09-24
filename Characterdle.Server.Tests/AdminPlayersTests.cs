using System.Net;
using System.Net.Http.Json;
using Characterdle.Server.Features.Admin;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests
{
    [Fact]
    public async Task PlayersListIsReadOnlyAdminOnlyAndNotCached()
    {
        SignIn("admin");
        var response = await client.GetAsync("/api/admin/players");
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        var rows = (await response.Content.ReadFromJsonAsync<AdminPlayerProfile[]>())!;
        Assert.Equal(2,rows.Length);
        Assert.Equal("admin-visible@example.invalid",rows[0].Email);
        Assert.Equal(0,rows[1].CharacterAttempts);
        Assert.Equal(0,rows[1].LadderDaysPlayed);
        Assert.Contains("no-store",response.Headers.CacheControl!.ToString());
        Assert.Contains("Authorization",response.Headers.Vary);
        Assert.Contains("noindex",response.Headers.GetValues("X-Robots-Tag").Single());
        Assert.DoesNotContain("stripe",await response.Content.ReadAsStringAsync(),StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.MethodNotAllowed,(await client.PostAsJsonAsync("/api/admin/players",new { isPremium=true })).StatusCode);
        Assert.Equal(1,players.Reads);
    }

    [Fact]
    public async Task PlayersFailureDoesNotExposeDatabaseDetails()
    {
        SignIn("admin"); players.Fail=true;
        var response=await client.GetAsync("/api/admin/players");
        Assert.Equal(HttpStatusCode.ServiceUnavailable,response.StatusCode);
        Assert.DoesNotContain("private-database-details",await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("character","Character")]
    [InlineData("quote","Quote")]
    [InlineData("episode_ladder","Episode Ladder")]
    public void AdminCommentsUseCorrectModeLabel(string mode,string label) => Assert.Equal(label,AdminCommentsRepository.GameModeLabel(mode));

    [Fact]
    public void PlayerWinRatesUseAllCompletedAttempts()
    {
        Assert.Equal(0m,AdminPlayersRepository.WinRate(0,0));
        Assert.Equal(25m,AdminPlayersRepository.WinRate(1,4));
        Assert.Equal(66.67m,AdminPlayersRepository.WinRate(2,3));
    }

    private sealed class PlayersStore : IAdminPlayersRepository
    {
        public int Reads;
        public bool Fail;
        public Task<IReadOnlyList<AdminPlayerProfile>> GetAsync(CancellationToken ct)
        {
            Reads++;
            if(Fail) throw new InvalidOperationException("private-database-details");
            var player = new AdminPlayerProfile(AdminId,"Player","admin-visible@example.invalid",null,DateTimeOffset.UtcNow,
                "Premium",DateTimeOffset.UtcNow,3,5,4,1,25,2,0,0,0,null,100,1,100);
            return Task.FromResult<IReadOnlyList<AdminPlayerProfile>>([player,player with {
                Id=PlayerId,DisplayName="Not yet played",Membership="Free",LastPlayedAt=null,
                CharacterAttempts=0,CharacterWins=0,CharacterWinRate=0,CharacterAverageGuesses=null,
                CurrentStreak=0,LongestStreak=0,LadderPoints=0,LadderDaysPlayed=0,LadderPointsPerDay=0 }]);
        }
    }
}
