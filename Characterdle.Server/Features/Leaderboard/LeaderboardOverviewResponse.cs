namespace Characterdle.Server.Features.Leaderboard;

public sealed record LeaderboardOverviewResponse(
    int PlayerCount,
    int TotalPlays,
    int TotalWins,
    int TotalCharacterWins,
    int TotalQuoteWins,
    double? AverageGuesses);
