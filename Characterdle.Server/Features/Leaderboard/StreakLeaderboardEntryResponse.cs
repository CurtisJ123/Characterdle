namespace Characterdle.Server.Features.Leaderboard;

public sealed record StreakLeaderboardEntryResponse(
    int Rank,
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    int CurrentStreak,
    int LongestStreak,
    bool IsCurrentUser);
