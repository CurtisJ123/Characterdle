namespace Characterdle.Server.Features.Profile;

public sealed record ProfileEpisodeLadderStatsResponse(
    int Wins,
    int Plays,
    int Losses,
    double? AverageAttempts,
    double CompletionRate,
    long TotalPoints,
    int DaysPlayed,
    double PointsPerDay,
    long? Rank);
