using Characterdle.Server.Features.Leaderboard;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class GameReplayQueryTests
{
    [Fact]
    public void ReplaysRequireExpiredNonqualifyingResultAndNextAttempt()
    {
        var sql = LeaderboardRepository.BuildUpsertQuery();
        Assert.Contains("status = 'lost'", sql);
        Assert.Contains("status = 'won' and public.\"UniverseGameResults\".hint_count > 0", sql);
        Assert.Contains("interval '30 days'", sql);
        Assert.Contains("excluded.attempt_number = public.\"UniverseGameResults\".attempt_number + 1", sql);
        // A replay may finish on its first guess, without sending a playing request first.
        Assert.DoesNotContain("and excluded.status = 'playing'", sql);
    }

    [Fact]
    public void ExistingProgressAndCompletionEnrichmentRequireTheSameAttempt()
    {
        var sql = LeaderboardRepository.BuildUpsertQuery();
        Assert.Contains("status = 'playing'\n  and public.\"UniverseGameResults\".attempt_number = excluded.attempt_number", sql.Replace("\r", ""));
        Assert.Contains("status = excluded.status\n  and public.\"UniverseGameResults\".attempt_number = excluded.attempt_number", sql.Replace("\r", ""));
        Assert.Contains("where @attemptNumber = 0 or exists", sql);
    }

    [Fact]
    public void NewAttemptGetsItsOwnCompletionDate()
    {
        var sql = LeaderboardRepository.BuildUpsertQuery();
        Assert.Contains("and public.\"UniverseGameResults\".attempt_number = excluded.attempt_number\n      then public.\"UniverseGameResults\".completed_at", sql.Replace("\r", ""));
        Assert.Contains("else excluded.completed_at", sql);
    }
}
