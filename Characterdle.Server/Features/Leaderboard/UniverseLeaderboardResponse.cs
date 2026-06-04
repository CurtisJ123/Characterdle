namespace Characterdle.Server.Features.Leaderboard;

public sealed record UniverseLeaderboardResponse(
    string UniverseId,
    string UniverseName,
    LeaderboardOverviewResponse Overview,
    LeaderboardModeOverviewResponse CharacterOverview,
    LeaderboardModeOverviewResponse QuoteOverview,
    LeaderboardEntryResponse? CurrentUser,
    IReadOnlyList<LeaderboardEntryResponse> Rows);
