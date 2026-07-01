namespace Characterdle.Server.Features.Leaderboard;

public sealed record UniverseStreakResponse(
    int CurrentStreak,
    int LongestStreak,
    DateOnly? LastCreditDate);
