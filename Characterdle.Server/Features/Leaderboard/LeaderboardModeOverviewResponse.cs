namespace Characterdle.Server.Features.Leaderboard;

public sealed record LeaderboardModeOverviewResponse(
    int PlayerCount,
    int TotalPlays,
    int TotalWins,
    double? AverageGuesses);
