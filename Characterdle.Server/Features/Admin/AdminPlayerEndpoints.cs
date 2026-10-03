using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Features.Announcements;

public static partial class AnnouncementEndpoints
{
    private static void MapAdminPlayerEndpoints(this RouteGroupBuilder admin)
    {
        var players = admin.MapGroup("/players").AddEndpointFilter(async (context, next) =>
        {
            try { return await next(context); }
            catch (PlayerModerationException ex) { return Results.Problem(ex.Message,statusCode:ex.Status); }
        });
        players.MapGet("/{userId:guid}", async (Guid userId,HttpContext context,IAdminPlayerDetailsRepository repo,CancellationToken ct) =>
            await repo.GetAsync(userId,Admin(context).UserId,ct) is { } details ? Results.Ok(details) : Results.NotFound());
        players.MapGet("/{userId:guid}/games", async (Guid userId,string? mode,int? page,IAdminPlayerDetailsRepository repo,CancellationToken ct) =>
        {
            if (!ValidPage(page) || mode is not (null or "all" or "character" or "quote" or "episode_ladder")) return Invalid("filters","Choose a valid mode and page.");
            return Results.Ok(await repo.GamesAsync(userId,mode ?? "all",page ?? 1,ct));
        });
        players.MapGet("/{userId:guid}/activity", async (Guid userId,string? guestId,int? page,IAdminPlayerDetailsRepository repo,CancellationToken ct) =>
        {
            if (!ValidPage(page) || page>40) return Invalid("page","Choose a page between 1 and 40.");
            Guid? guest = null;
            if (guestId is not null) {
                if (!LeaderboardVisibility.TryGuestId(guestId,out var id)) return Invalid("guestId","Enter a valid guest UUID.");
                guest=id;
            }
            return Results.Ok(await repo.ActivityAsync(userId,guest,page ?? 1,ct));
        });
        players.MapGet("/{userId:guid}/moderation-history", async (Guid userId,int? page,IPlayerModerationRepository repo,CancellationToken ct) =>
            ValidPage(page) ? Results.Ok(await repo.HistoryAsync(userId,page ?? 1,ct)) : Invalid("page","Invalid page."));
        players.MapGet("/guest/{guestId}", async (string guestId,IPlayerModerationRepository repo,CancellationToken ct) =>
            LeaderboardVisibility.TryGuestId(guestId,out var id) ? Results.Ok(await repo.GuestAsync(id,ct)) : Invalid("guestId","Enter a valid guest UUID."));
        players.MapPut("/{userId:guid}/moderation", async (Guid userId,SavePlayerModerationRequest request,HttpContext context,IPlayerModerationRepository repo,CancellationToken ct) =>
        {
            if (PlayerModerationValidation.Validate(request) is { } error) return Invalid("moderation",error);
            if (userId == Admin(context).UserId && (request.State == "shadow_banned" || request.GuestIds.Length>0))
                return Results.Problem("You cannot restrict yourself.",statusCode:403);
            return Results.Ok(await repo.SaveAsync(userId,Admin(context).UserId,request,ct));
        });
    }
}
