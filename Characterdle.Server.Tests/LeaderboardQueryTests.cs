using System.Text.RegularExpressions;
using Characterdle.Server.Features.Leaderboard;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class LeaderboardQueryTests
{
    [Theory]
    [InlineData("overview")]
    [InlineData("rows")]
    [InlineData("current-user")]
    public void PlaysIncludeAllFinishedResultsRegardlessOfHints(string queryKind)
    {
        var sql = GetQuery(queryKind);
        var scope = Regex.Match(
            sql,
            @"where results\.universe_id = @universeId(?<filters>.*?)(?:;|group by)",
            RegexOptions.Singleline);

        Assert.True(scope.Success);
        Assert.Equal(
            "and results.mode in ('character', 'quote') and results.status in ('won', 'lost')",
            Regex.Replace(scope.Groups["filters"].Value, @"\s+", " ").Trim());
        Assert.Contains("count(*)::int as total_plays", sql);

        foreach (var mode in new[] { "character", "quote" })
        {
            var alias = queryKind == "overview" ? $"{mode}_total_plays" : $"{mode}_plays";
            Assert.Contains($"count(*) filter (where results.mode = '{mode}')::int as {alias}", sql);
        }
    }

    [Theory]
    [InlineData("overview")]
    [InlineData("rows")]
    [InlineData("current-user")]
    public void OnlyWinsWithoutHintsCountAsWins(string queryKind)
    {
        var sql = GetQuery(queryKind);
        Assert.Contains(
            "count(*) filter (where results.status = 'won' and results.hint_count = 0)::int as total_wins",
            sql);

        foreach (var mode in new[] { "character", "quote" })
        {
            var alias = queryKind == "overview" ? $"total_{mode}_wins" : $"{mode}_wins";
            Assert.Contains(
                $"count(*) filter (where results.status = 'won' and results.hint_count = 0 and results.mode = '{mode}')::int as {alias}",
                sql);
        }
    }

    [Theory]
    [InlineData("overview")]
    [InlineData("rows")]
    [InlineData("current-user")]
    public void AverageGuessesStillUsesOnlyWinsWithoutHints(string queryKind)
    {
        var sql = GetQuery(queryKind);
        Assert.Contains(
            "round(avg(results.guess_count) filter (where results.status = 'won' and results.hint_count = 0)::numeric, 2) as average_guesses",
            sql);

        foreach (var mode in new[] { "character", "quote" })
        {
            Assert.Contains(
                $"round(avg(results.guess_count) filter (where results.status = 'won' and results.hint_count = 0 and results.mode = '{mode}')::numeric, 2) as {mode}_average_guesses",
                sql);
        }
    }

    [Theory]
    [InlineData("rows")]
    [InlineData("current-user")]
    public void WinRateDividesWinsByAllPlaysAsAPercentage(string queryKind)
    {
        var sql = GetQuery(queryKind);
        Assert.Contains("when aggregated.total_plays = 0 then 0", sql);
        Assert.Contains(
            "else (aggregated.total_wins::numeric / aggregated.total_plays::numeric) * 100",
            sql);
    }

    private static string GetQuery(string queryKind) => queryKind switch
    {
        "overview" => LeaderboardRepository.BuildOverviewQuery(),
        "rows" => LeaderboardRepository.BuildRowsQuery(),
        "current-user" => LeaderboardRepository.BuildCurrentUserQuery(),
        _ => throw new ArgumentOutOfRangeException(nameof(queryKind)),
    };
}
