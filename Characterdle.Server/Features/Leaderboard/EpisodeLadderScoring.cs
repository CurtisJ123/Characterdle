using Characterdle.Server.Features.EpisodeLadder;

namespace Characterdle.Server.Features.Leaderboard;

internal static class EpisodeLadderScoring
{
    public static int BasePoints(int difficulty) => difficulty switch
    {
        1 => 10, 2 => 15, 3 => 20, 4 => 25, 5 => 30,
        _ => throw new ArgumentOutOfRangeException(nameof(difficulty)),
    };

    internal static int AfterFailedGuesses(int basePoints, int failedGuesses) =>
        (int)Math.Floor(Math.Max(0m, basePoints * (1m - 0.2m * failedGuesses)));

    public static int Points(int difficulty, string status, int attempts) =>
        status == "won" && difficulty is >= 1 and <= 5 && attempts is >= 1 and <= EpisodeLadderRules.MaxAttempts
            ? AfterFailedGuesses(BasePoints(difficulty), attempts - 1)
            : 0;

    // PostgreSQL arrays are one-based: four attempt scores for each successive difficulty.
    public static int[] ScoreTable() => Enumerable.Range(1, 5)
        .SelectMany(difficulty => Enumerable.Range(1, EpisodeLadderRules.MaxAttempts)
            .Select(attempts => Points(difficulty, "won", attempts))).ToArray();
}
