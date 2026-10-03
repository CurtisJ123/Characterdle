using System.Text.Json;
using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Features.Admin;

public sealed record AdminPageResult<T>(IReadOnlyList<T> Items, int Page, bool HasNextPage);
public sealed record ModerationGuestLink(Guid GuestId, DateTimeOffset LinkedAt, Guid LinkedBy);
public sealed record PlayerModerationState(string State, bool IsRestricted, string Reason, DateTimeOffset? ExpiresAt,
    DateTimeOffset? UpdatedAt, Guid? UpdatedBy, long Revision, IReadOnlyList<ModerationGuestLink> GuestLinks);
public sealed record GuestReassignment(string GuestId, Guid FromUserId, long ExpectedRevision);
public sealed record SavePlayerModerationRequest(string State, string Reason, DateTimeOffset? ExpiresAt,
    long ExpectedRevision, Guid RequestId, string[] GuestIds, GuestReassignment[] Reassignments, bool Confirmed);
public sealed record ModerationAuditEntry(long Id, Guid ActorId, DateTimeOffset CreatedAt, string Action, string Reason,
    JsonElement PreviousState, JsonElement NewState, Guid RequestId);
public sealed record GuestEvidence(Guid GuestId, long RecordedGames, long CompletedGames, DateTimeOffset? LastPlayedAt,
    Guid? LinkedUserId, string? LinkedDisplayName, long? LinkedRevision);
public sealed record AdminPlayerDetails(AdminPlayerProfile Profile, PlayerModerationState Moderation,
    bool IsAdmin, bool CanRestrict, AdminBillingDetails Billing, decimal LadderFirstAttemptWinRate);
public sealed record AdminBillingDetails(string? Status, DateTimeOffset? CurrentPeriodStart,
    DateTimeOffset? CurrentPeriodEnd, bool CancelAtPeriodEnd, DateTimeOffset? CancelAt);
public sealed record AdminGameHistory(string UniverseId, long GameId, string Mode, string Status, int GuessCount,
    int HintCount, DateTimeOffset? CompletedAt, int? Difficulty, int? Points, long[][]? Attempts, long? DailyPoints);
public sealed record AdminActivity(string UniverseId, long GameId, string Mode, string? Status, int GuessCount,
    DateTimeOffset UpdatedAt, DateTimeOffset? CompletedAt, string? GuestKey, string? GuestStatus,
    int? GuestGuessCount, DateTimeOffset? GuestCompletedAt, double? SecondsBefore);
public sealed record RepeatedGuestMatch(string GuestKey, long Matches, DateTimeOffset LastMatchAt);
public sealed record AdminActivityPage(AdminPageResult<AdminActivity> History, IReadOnlyList<RepeatedGuestMatch> RepeatedGuests);

public interface IPlayerModerationRepository
{
    Task<PlayerModerationState> GetAsync(Guid userId, CancellationToken ct);
    Task<PlayerModerationState> SaveAsync(Guid userId, Guid actorId, SavePlayerModerationRequest request, CancellationToken ct);
    Task<AdminPageResult<ModerationAuditEntry>> HistoryAsync(Guid userId, int page, CancellationToken ct);
    Task<GuestEvidence> GuestAsync(Guid guestId, CancellationToken ct);
}
public interface IAdminPlayerDetailsRepository
{
    Task<AdminPlayerDetails?> GetAsync(Guid userId, Guid actorId, CancellationToken ct);
    Task<AdminPageResult<AdminGameHistory>> GamesAsync(Guid userId, string mode, int page, CancellationToken ct);
    Task<AdminActivityPage> ActivityAsync(Guid userId, Guid? guestId, int page, CancellationToken ct);
}
public sealed class PlayerModerationException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

internal static class PlayerModerationValidation
{
    internal static string? Validate(SavePlayerModerationRequest request)
    {
        if (!request.Confirmed) return "Confirm the leaderboard-only change before saving.";
        if (request.State is not ("normal" or "shadow_banned")) return "Choose a valid restriction state.";
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 2000 || request.Reason.Any(c => char.IsControl(c) && c is not '\n' and not '\r' and not '\t'))
            return "Enter an internal reason of 1 to 2,000 characters.";
        if (request.ExpectedRevision < 0 || request.RequestId == Guid.Empty) return "Reload the player before saving.";
        if (request.State == "normal" && request.ExpiresAt.HasValue) return "An unrestricted account cannot have a restriction expiry.";
        if (request.GuestIds is null || request.GuestIds.Length > 20 || request.GuestIds.Any(id => !LeaderboardVisibility.TryGuestId(id, out _)))
            return "Enter up to 20 valid guest UUIDs (bare UUID or guest:UUID).";
        if (request.GuestIds.Select(id => { LeaderboardVisibility.TryGuestId(id, out var parsed); return parsed; }).Distinct().Count() != request.GuestIds.Length)
            return "Each guest ID must appear only once.";
        if (request.Reassignments is null || request.Reassignments.Length > 20 || request.Reassignments.Any(r => r is null ||
            !LeaderboardVisibility.TryGuestId(r.GuestId, out _) || r.FromUserId == Guid.Empty || r.ExpectedRevision < 0))
            return "Invalid guest reassignment confirmation.";
        return null;
    }
}
