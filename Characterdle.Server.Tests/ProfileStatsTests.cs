using System.Text.RegularExpressions;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Profile;
using Characterdle.Server.Features.UniverseGames;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class ProfileStatsTests
{
    [Fact]
    public void CompletedHistoryIncludesHintedGamesAndPriorAttemptsButNotInProgressGames()
    {
        var sql = ProfileResultQueries.CompletedResults("got");
        Assert.Contains("from public.\"UniverseCompletedGameResults\"", sql);
        Assert.DoesNotContain("from public.\"UniverseGameResults\"", sql);
        Assert.Contains("status in ('won', 'lost')", sql);
        Assert.DoesNotContain("hint_count = 0", sql);
        Assert.DoesNotContain("distinct", sql, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("got")]
    [InlineData("other")]
    public void WinsAndWinAveragesRequireNoHintsWhilePlaysIncludeEveryCompletion(string universeId)
    {
        var universe = UniverseCatalog.CreateDefault().Universes.Single() with { Id = universeId };
        var sql = ProfileRepository.BuildStatsQuery(universe);
        Assert.Contains("count(*) filter (where results.status = 'won' and results.hint_count = 0)::int as total_wins", sql);
        Assert.Contains("count(*)::int as total_plays", sql);
        Assert.Contains("round(avg(results.guess_count) filter (where results.status = 'won' and results.hint_count = 0)::numeric, 2) as average_guesses", sql);
        foreach (var mode in new[] { "character", "quote" })
        {
            var cleanWin = $"results.mode = '{mode}' and results.status = 'won' and results.hint_count = 0";
            Assert.Contains($"count(*) filter (where {cleanWin})::int as {mode}_wins", sql);
            Assert.Contains($"round(avg(results.guess_count) filter (where {cleanWin})::numeric, 2) as {mode}_average_guesses", sql);
            Assert.Contains($"count(*) filter (where results.mode = '{mode}')::int as {mode}_plays", sql);
            Assert.Contains($"round(avg(results.hint_count) filter (where results.mode = '{mode}')::numeric, 2) as {mode}_average_hints", sql);
            Assert.Contains($"count(*) filter (where results.mode = '{mode}' and results.status = 'lost')::int as {mode}_losses", sql);
        }
        Assert.Contains("from completed_results as results;", sql);
    }

    [Fact]
    public void CompletionMeasuresUniqueHintFreeWinsNotRepeatedArchiveAttempts()
    {
        var sql = ProfileRepository.BuildStatsQuery(UniverseCatalog.CreateDefault().Universes.Single());
        Assert.Contains("count(distinct (results.mode, results.game_id, results.difficulty)) filter (where results.status = 'won' and results.hint_count = 0)", sql);
        foreach (var mode in new[] { "character", "quote" })
            Assert.Contains($"count(distinct results.game_id) filter (where results.mode = '{mode}' and results.status = 'won' and results.hint_count = 0)", sql);
    }

    [Fact]
    public void ProfileRanksUseTheLeaderboardSourceAndIncludeHintedPlaysInTieBreakers()
    {
        var sql = ProfileRepository.BuildRanksQuery();
        var leaderboardSql = LeaderboardRepository.BuildRowsQuery();
        Assert.Contains("join public.\"UniverseCompletedGameResults\" as results", sql);
        var scope = Regex.Match(sql, @"where results\.universe_id = @universeId(?<filters>.*?)group by", RegexOptions.Singleline);
        Assert.True(scope.Success);
        Assert.Equal("and results.mode in ('character', 'quote') and results.status in ('won', 'lost')",
            Regex.Replace(scope.Groups["filters"].Value, @"\s+", " ").Trim());
        var projections = Regex.Matches(sql, @"(?:count\(\*\)|round\(avg\(results\.guess_count\)).*? as \w+");
        Assert.Equal(9, projections.Count);
        foreach (Match projection in projections)
            Assert.Contains(projection.Value, leaderboardSql);
        var rankOrder = Regex.Match(sql, @"dense_rank\(\) over \((?<order>.*?)\)::int as overall_rank", RegexOptions.Singleline);
        Assert.True(rankOrder.Success);
        Assert.Contains(Regex.Replace(rankOrder.Groups["order"].Value, @"\s+", " ").Trim(),
            Regex.Replace(leaderboardSql, @"\s+", " "));
        Assert.Contains("aggregated.character_plays desc", sql);
        Assert.Contains("aggregated.quote_plays desc", sql);
    }

    [Fact]
    public void CompletedResultsUseDifficultyProgressWithoutCountingDailySummaryAgain()
    {
        var sql = ProfileResultQueries.CompletedResults("got");
        Assert.Contains("mode in ('character', 'quote')", sql);
        Assert.Contains("union all", sql);
        Assert.Contains("public.\"GOTEpisodeLadderProgress\" progress", sql);
        Assert.Contains("progress.user_id = @userId", sql);
        Assert.Contains("games.datetime <= now()", sql);
        Assert.Contains("progress.status in ('won', 'lost')", sql);
        Assert.Contains("progress.difficulty between 1 and 5", sql);
        Assert.Contains("jsonb_array_length(progress.attempts) between 1 and @maxAttempts", sql);
        Assert.DoesNotContain("mode in ('character', 'quote', 'episode_ladder')", sql);
        Assert.DoesNotContain("UniverseGamePlays", sql);
    }

    [Fact]
    public void PointsUseTheSameLookupAsLeaderboardAndLossesScoreZero()
    {
        var sql = ProfileResultQueries.CompletedResults("got");
        Assert.Contains("case when progress.status = 'won'", sql);
        Assert.Contains("(@points)[(progress.difficulty - 1) * @maxAttempts + jsonb_array_length(progress.attempts)]", sql);
        Assert.Contains("else 0 end", sql);
        Assert.Contains("0, progress.updated_at", sql);
        Assert.Contains("progress.difficulty,", sql);
    }

    [Fact]
    public void TotalsUseAllModesAndCompletionIncludesAvailableLadderDifficulties()
    {
        var universe = UniverseCatalog.CreateDefault().Universes.Single();
        var sql = ProfileRepository.BuildStatsQuery(universe);
        Assert.Contains("from completed_results as results", sql);
        Assert.Contains("character_total_available + quote_total_available + ladder_total_available", sql);
        Assert.Contains("public.\"GOTEpisodeLadderGames\" ladder", sql);
        Assert.Contains("games.datetime <= now() and ladder.difficulty between 1 and 5", sql);
        Assert.Contains("count(distinct results.game_id) filter (where results.mode = 'episode_ladder')", sql);
        Assert.Contains("coalesce(sum(results.points), 0)::bigint", sql);
        Assert.Contains("nullif((select ladder_total_available from available_games), 0)", sql);
        Assert.Contains("results.mode = 'episode_ladder' and results.status = 'won'", sql);
        Assert.Contains("ladder_points_per_day", sql);
    }

    [Fact]
    public void OtherUniversesDoNotQueryGotLadderTables()
    {
        var universe = UniverseCatalog.CreateDefault().Universes.Single() with
        {
            Id = "other", GameTableName = "public.\"OtherGames\"", QuoteTableName = null,
        };
        var sql = ProfileRepository.BuildStatsQuery(universe);
        Assert.DoesNotContain("GOTEpisodeLadder", sql);
        Assert.DoesNotContain("@points", sql);
        Assert.Contains("0 as ladder_total_available", sql);
        Assert.Contains("0::int as quote_total_available", sql);
    }
}
