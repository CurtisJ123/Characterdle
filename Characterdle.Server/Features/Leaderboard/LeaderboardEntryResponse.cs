namespace Characterdle.Server.Features.Leaderboard;

public sealed record LeaderboardEntryResponse(
    int Rank,
    Guid UserId,
    string DisplayName,
    string? AvatarUrl,
    int TotalWins,
    int CharacterWins,
    int QuoteWins,
    int TotalPlays,
    int CharacterPlays,
    int QuotePlays,
    double? AverageGuesses,
    double? CharacterAverageGuesses,
    double? QuoteAverageGuesses,
    double WinRate,
    bool IsCurrentUser);
