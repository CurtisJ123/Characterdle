namespace Characterdle.Server.Features.Profile;

public sealed record ProfileModeStatsResponse(
    string Mode,
    int Wins,
    int Plays,
    int Losses,
    double? AverageGuesses,
    double? AverageHints,
    int? Rank);
