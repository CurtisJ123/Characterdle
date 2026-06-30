namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseGameModeStatsResponse(
    int PlayCount,
    int AverageGuessSampleSize,
    double? AverageGuesses);
