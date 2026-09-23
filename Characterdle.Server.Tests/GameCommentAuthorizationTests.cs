using Characterdle.Server.Features.GameComments;
using Characterdle.Server.Features.UniverseGames;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class GameCommentAuthorizationTests
{
    [Fact]
    public void LadderAuthorizationUsesAllFiveSavedDifficultiesForTheSamePlayerAndDay()
    {
        Assert.True(UniverseCatalog.CreateDefault().TryGet("got", out var universe));
        var sql = GameCommentRepository.CompletedGameSql(universe, "episode_ladder");
        Assert.Contains("@universeId = 'got'", sql);
        Assert.Contains("games.id = @gameId", sql);
        Assert.Contains("games.datetime <= now()", sql);
        Assert.Contains("player.user_id = @userId", sql);
        Assert.Contains("count(distinct progress.difficulty)", sql);
        Assert.Contains("progress.user_id = @userId", sql);
        Assert.Contains("progress.game_id = games.id", sql);
        Assert.Contains("progress.difficulty between 1 and 5", sql);
        Assert.Contains("progress.status in ('won', 'lost')", sql);
        Assert.Contains(") = 5", sql);
        Assert.DoesNotContain("UniverseGameResults", sql);
        Assert.DoesNotContain("interval", sql);
    }

    [Theory]
    [InlineData("character")]
    [InlineData("quote")]
    public void OtherModesKeepTheirExistingCompletionRules(string mode)
    {
        Assert.True(UniverseCatalog.CreateDefault().TryGet("got", out var universe));
        var sql = GameCommentRepository.CompletedGameSql(universe, mode);
        Assert.Contains("UniverseGameResults", sql);
        Assert.Contains("results.mode = @mode", sql);
        Assert.Contains("results.user_id = @userId", sql);
        Assert.Contains("results.game_id = @gameId", sql);
        Assert.Contains("interval '30 days'", sql);
        Assert.DoesNotContain("GOTEpisodeLadderProgress", sql);
        Assert.Equal(mode == "quote", sql.Contains("games.quote_id is not null"));
    }
}
