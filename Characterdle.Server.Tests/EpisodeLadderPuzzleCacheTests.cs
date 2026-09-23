using Characterdle.Server.Features.EpisodeLadder;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class EpisodeLadderPuzzleCacheTests
{
    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.Parse("2026-09-23T12:00:00Z");
        public override DateTimeOffset GetUtcNow() => Now;
    }

    private static LadderPuzzle[] Day(long id = 50) => Enumerable.Range(1, 5)
        .Select(level => EpisodeLadderRulesTests.Puzzle(id) with { Difficulty = level }).ToArray();

    [Fact]
    public void AllDifficultiesShareOneDefinitionCacheWithoutCachingArchiveAge()
    {
        using var cache = new EpisodeLadderPuzzleCache(new Clock());
        cache.Set(Day());
        var today = EpisodeLadderRulesTests.Puzzle(50, 10).Game;
        for (var level = 1; level <= 5; level++)
        {
            var puzzle = cache.Get(today, level);
            Assert.Equal(level, puzzle!.Difficulty);
            Assert.Equal(10, puzzle.Game.ArchiveIndex);
        }
        Assert.Null(cache.Get(today with { Id = 51 }, 1));
    }

    [Fact]
    public void EntriesExpireSoCatalogEditsDoNotStayStaleIndefinitely()
    {
        var clock = new Clock();
        using var cache = new EpisodeLadderPuzzleCache(clock);
        var day = Day();
        cache.Set(day);
        Assert.NotNull(cache.Get(day[0].Game, 1));
        clock.Now += EpisodeLadderPuzzleCache.Lifetime;
        Assert.Null(cache.Get(day[0].Game, 1));
    }

    [Fact]
    public void IncompleteDaysAndRandomRoundsAreNotCached()
    {
        using var cache = new EpisodeLadderPuzzleCache(new Clock());
        cache.Set(Day().Take(4).ToArray());
        Assert.Null(cache.Get(Day()[0].Game, 1));
        cache.Set(Day(0));
        Assert.Null(cache.Get(Day(0)[0].Game, 1));
        cache.Set(Enumerable.Repeat(Day()[0], 5).ToArray());
        Assert.Null(cache.Get(Day()[0].Game, 1));
    }

    [Fact]
    public void CacheSnapshotsCannotBeChangedByMutatingTheSourceEvents()
    {
        using var cache = new EpisodeLadderPuzzleCache(new Clock());
        var day = Day();
        var events = day[0].Events.ToArray();
        day[0] = day[0] with { Events = events };
        var expected = events[0];
        cache.Set(day);
        events[0] = events[0] with { Id = 999 };
        Assert.Equal(expected, cache.Get(day[0].Game, 1)!.Events[0]);
    }
}
