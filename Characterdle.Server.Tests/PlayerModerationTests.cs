using System.Net;
using System.Net.Http.Json;
using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Leaderboard;
using Microsoft.Extensions.Logging.Abstractions;
using Npgsql;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed partial class AnnouncementEndpointTests
{
    private static SavePlayerModerationRequest Restriction() => new("shadow_banned", "Manual evidence review", null, 0,
        Guid.NewGuid(), [], [], true);

    [Theory]
    [InlineData(null,HttpStatusCode.Unauthorized)]
    [InlineData("invalid",HttpStatusCode.Unauthorized)]
    [InlineData("player",HttpStatusCode.Forbidden)]
    public async Task AllPlayerInvestigationAndMutationRoutesRequireVerifiedAdmin(string? token,HttpStatusCode expected)
    {
        SignIn(token);
        foreach (var suffix in new[] { "", "/games", "/activity", "/moderation-history" })
            Assert.Equal(expected,(await client.GetAsync($"/api/admin/players/{PlayerId}{suffix}")).StatusCode);
        Assert.Equal(expected,(await client.GetAsync($"/api/admin/players/guest/{Guid.NewGuid()}")).StatusCode);
        Assert.Equal(expected,(await client.PutAsJsonAsync($"/api/admin/players/{PlayerId}/moderation",Restriction())).StatusCode);
        Assert.Equal(0,moderation.Writes);
    }

    [Fact]
    public async Task ActorComesFromVerifiedAdminAndResponsesArePrivate()
    {
        SignIn("admin");
        var body=Restriction();
        var response=await client.PutAsJsonAsync($"/api/admin/players/{PlayerId}/moderation?actorId={PlayerId}",body);
        Assert.Equal(HttpStatusCode.OK,response.StatusCode);
        Assert.Equal(AdminId,moderation.Actor); Assert.Equal(PlayerId,moderation.Target);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Contains("Authorization",response.Headers.Vary);
        Assert.Equal(HttpStatusCode.Forbidden,(await client.PutAsJsonAsync($"/api/admin/players/{AdminId}/moderation",body)).StatusCode);
        Assert.Equal(1,moderation.Writes);
    }

    [Fact]
    public async Task ValidateBeforeWritingAndReturnConflictsWithoutLeakingErrors()
    {
        SignIn("admin");
        foreach (var request in new[] { Restriction() with {Confirmed=false},Restriction() with {Reason=""},
            Restriction() with {State="suspended"},Restriction() with {GuestIds=["invalid"]},
            Restriction() with {ExpectedRevision=-1},Restriction() with {RequestId=Guid.Empty} })
            Assert.Equal(HttpStatusCode.BadRequest,(await client.PutAsJsonAsync($"/api/admin/players/{PlayerId}/moderation",request)).StatusCode);
        Assert.Equal(0,moderation.Writes);
        moderation.Failure=new PlayerModerationException(409,"Reload and review.");
        Assert.Equal(HttpStatusCode.Conflict,(await client.PutAsJsonAsync($"/api/admin/players/{PlayerId}/moderation",Restriction())).StatusCode);
        moderation.Failure=new InvalidOperationException("private-database-details");
        var response=await client.PutAsJsonAsync($"/api/admin/players/{PlayerId}/moderation",Restriction());
        Assert.Equal(HttpStatusCode.ServiceUnavailable,response.StatusCode);
        Assert.DoesNotContain("private-database-details",await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("games?page=0")]
    [InlineData("games?mode=arbitrary")]
    [InlineData("activity?page=41")]
    [InlineData("activity?guestId=not-a-uuid")]
    [InlineData("moderation-history?page=10001")]
    public async Task DetailsPaginationAndFiltersAreBounded(string suffix)
    {
        SignIn("admin");
        Assert.Equal(HttpStatusCode.BadRequest,(await client.GetAsync($"/api/admin/players/{PlayerId}/{suffix}")).StatusCode);
    }

    private sealed class ModerationStore : IPlayerModerationRepository
    {
        public int Writes; public Guid Actor; public Guid Target; public Exception? Failure;
        public static PlayerModerationState Normal => new("normal",false,"",null,null,null,0,[]);
        public Task<PlayerModerationState> GetAsync(Guid id,CancellationToken ct)=>Task.FromResult(Normal);
        public Task<PlayerModerationState> SaveAsync(Guid id,Guid actor,SavePlayerModerationRequest request,CancellationToken ct)
        { if(Failure is not null) throw Failure; Writes++; Actor=actor; Target=id; return Task.FromResult(Normal); }
        public Task<AdminPageResult<ModerationAuditEntry>> HistoryAsync(Guid id,int page,CancellationToken ct)=>Task.FromResult(new AdminPageResult<ModerationAuditEntry>([],page,false));
        public Task<GuestEvidence> GuestAsync(Guid id,CancellationToken ct)=>Task.FromResult(new GuestEvidence(id,0,0,null,null,null,null));
    }
    private sealed class PlayerDetailsStore : IAdminPlayerDetailsRepository
    {
        public Task<AdminPlayerDetails?> GetAsync(Guid id,Guid actor,CancellationToken ct)=>Task.FromResult<AdminPlayerDetails?>(null);
        public Task<AdminPageResult<AdminGameHistory>> GamesAsync(Guid id,string mode,int page,CancellationToken ct)=>Task.FromResult(new AdminPageResult<AdminGameHistory>([],page,false));
        public Task<AdminActivityPage> ActivityAsync(Guid id,Guid? guest,int page,CancellationToken ct)=>Task.FromResult(new AdminActivityPage(new([],page,false),[]));
    }
}

public sealed class ModerationValidationTests
{
    [Theory]
    [InlineData("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA",true)]
    [InlineData("guest:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",true)]
    [InlineData("guest:00000000-0000-0000-0000-000000000000",false)]
    [InlineData("{aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa}",false)]
    [InlineData("bad",false)]
    [InlineData(null,false)]
    public void GuestFormatIsStrict(string? input,bool valid)=>Assert.Equal(valid,LeaderboardVisibility.TryGuestId(input,out _));

    [Fact]
    public async Task AuthenticationPrecedesUntrustedGuestAndInvalidGuestDoesNotTouchDatabase()
    {
        await using var source=NpgsqlDataSource.Create("Host=127.0.0.1;Port=1;Database=offline;Username=offline;Timeout=1;Pooling=false");
        var resolver=new LeaderboardViewerResolver(source,NullLogger<LeaderboardViewerResolver>.Instance);
        var user=Guid.NewGuid();
        Assert.Equal(user,await resolver.ResolveAsync(user,Guid.NewGuid().ToString(),default));
        Assert.Null(await resolver.ResolveAsync(null,"bad",default));
        Assert.Null(await resolver.ResolveAsync(null,Guid.NewGuid().ToString(),default));
        await Assert.ThrowsAnyAsync<Exception>(()=>LeaderboardVisibility.RestrictedAsync(source,default));
    }

    [Fact]
    public void DuplicateGuestsAndInvalidReassignmentAreRejected()
    {
        var id=Guid.NewGuid().ToString();
        var request=new SavePlayerModerationRequest("shadow_banned","Reason",null,0,Guid.NewGuid(),[id,$"guest:{id}"],[],true);
        Assert.NotNull(PlayerModerationValidation.Validate(request));
        Assert.NotNull(PlayerModerationValidation.Validate(request with {GuestIds=[],Reassignments=[new("bad",Guid.NewGuid(),0)]}));
        Assert.Null(PlayerModerationValidation.Validate(request with {GuestIds=[id]}));
    }
}
