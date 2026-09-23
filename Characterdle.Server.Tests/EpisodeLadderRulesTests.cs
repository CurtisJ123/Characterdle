using Characterdle.Server.Features.EpisodeLadder;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class EpisodeLadderRulesTests
{
    internal static LadderPuzzle Puzzle(long gameId = 50, int archiveIndex = 0) => new(
        new LadderGameReference(gameId, DateTimeOffset.Parse("2026-09-11T04:00:00Z"), archiveIndex), 3,
        Enumerable.Range(1, 5).Select(id => new LadderEvent(id, $"Test event {id}", null,
            1, id, id, 10, 0, $"Story {id}", id, 6 - id, EpisodeTitle: $"Episode title {id}")).ToArray());

    [Fact]
    public void NewGameDoesNotExposeTheAnswerOrTiming()
    {
        var result = EpisodeLadderRules.Replay(Puzzle(), []);
        Assert.Null(result.Solution);
        Assert.Empty(result.LockedPositions);
        Assert.Empty(result.Attempts);
        Assert.Equal("playing", result.Status);
        Assert.Equal(new long[] { 5, 4, 3, 2, 1 }, result.InitialOrder);
        Assert.All(result.Events, entry => Assert.Null(entry.Episode));
        Assert.Equal(new[] { "Id", "Description", "PortraitUrl", "CharacterName", "Episode" }, typeof(LadderEventResponse).GetProperties().Select(p => p.Name));
    }

    [Fact]
    public void EpisodeDetailsAreOnlyReturnedForCorrectEventsAndPersistAcrossAttempts()
    {
        var first = EpisodeLadderRules.Replay(Puzzle(), [[1, 3, 2, 5, 4]]);
        Assert.Equal(new LadderEpisodeResponse(1, 1, "Episode title 1"), first.Events.Single(e => e.Id == 1).Episode);
        Assert.All(first.Events.Where(e => e.Id != 1), entry => Assert.Null(entry.Episode));

        var next = EpisodeLadderRules.Replay(Puzzle(), [[1, 3, 2, 5, 4], [1, 2, 3, 5, 4]]);
        Assert.All(next.Events.Where(e => e.Id <= 3), entry =>
            Assert.Equal(new LadderEpisodeResponse(1, (int)entry.Id, $"Episode title {entry.Id}"), entry.Episode));
        Assert.All(next.Events.Where(e => e.Id > 3), entry => Assert.Null(entry.Episode));
        Assert.Null(next.Solution);
    }

    [Fact]
    public void CompletedGamesKeepEarnedEpisodeDetailsWithoutGivingIncorrectCardsFeedback()
    {
        var lost = EpisodeLadderRules.Replay(Puzzle(), Enumerable.Repeat(new long[] { 5, 4, 3, 2, 1 }, 4).ToArray());
        Assert.Equal("lost", lost.Status);
        Assert.NotNull(lost.Events.Single(e => e.Id == 3).Episode);
        Assert.All(lost.Events.Where(e => e.Id != 3), entry => Assert.Null(entry.Episode));

        var won = EpisodeLadderRules.Replay(Puzzle(), [[1, 2, 3, 4, 5]]);
        Assert.All(won.Events, entry => Assert.NotNull(entry.Episode));
    }

    [Fact]
    public void FeedbackUsesExactOnScreenPositions()
    {
        var result = EpisodeLadderRules.Replay(Puzzle(), [[1, 3, 2, 5, 4]]);
        Assert.Equal(new[] { "correct", "adjacent", "adjacent", "adjacent", "adjacent" }, result.Attempts[0].Feedback);
        Assert.Equal(new[] { 0 }, result.LockedPositions);
        Assert.Null(result.Solution);
        var distant = EpisodeLadderRules.Replay(Puzzle(), [[5, 4, 3, 2, 1]]);
        Assert.Equal(new[] { "incorrect", "incorrect", "correct", "incorrect", "incorrect" }, distant.Attempts[0].Feedback);
    }

    [Fact]
    public void CorrectEventsCannotMoveOnLaterAttempts()
    {
        Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.Replay(Puzzle(), [[1, 3, 2, 5, 4], [2, 1, 3, 4, 5]]));
        var result = EpisodeLadderRules.Replay(Puzzle(), [[1, 3, 2, 5, 4], [1, 2, 3, 5, 4], [1, 2, 3, 4, 5]]);
        Assert.Equal("won", result.Status);
        Assert.Equal(5, result.LockedPositions.Count);
        Assert.Equal(new long[] { 1, 2, 3, 4, 5 }, result.Solution!.Select(e => e.Id));
    }

    [Fact]
    public void FourFailedAttemptsRevealTheAnswerAndStopPlay()
    {
        long[][] attempts = [[5, 4, 3, 2, 1], [5, 4, 3, 2, 1], [5, 4, 3, 2, 1], [5, 4, 3, 2, 1]];
        Assert.Equal("lost", EpisodeLadderRules.Replay(Puzzle(), attempts).Status);
        Assert.NotNull(EpisodeLadderRules.Replay(Puzzle(), attempts).Solution);
        Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.Replay(Puzzle(), [.. attempts, [1, 2, 3, 4, 5]]));
        Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.Replay(Puzzle(), [[1, 2, 3, 4, 5], [1, 2, 3, 4, 5]]));
    }

    [Fact]
    public void MissingDuplicateForeignAndInvalidEventsAreRejected()
    {
        foreach (var order in new long[][] { [1, 2, 3, 4], [1, 2, 3, 4, 4], [1, 2, 3, 4, 99], [0, 2, 3, 4, 5], [-1, 2, 3, 4, 5] })
            Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.Replay(Puzzle(), [order]));
    }

    [Fact]
    public void SavedHistoryMustRemainAnUnchangedPrefix()
    {
        Assert.True(EpisodeLadderRules.IsPrefix([[5, 4, 3, 2, 1]], [[5, 4, 3, 2, 1], [1, 2, 3, 4, 5]]));
        Assert.True(EpisodeLadderRules.IsPrefix([[5, 4, 3, 2, 1]], [[5, 4, 3, 2, 1]]));
        Assert.False(EpisodeLadderRules.IsPrefix([[5, 4, 3, 2, 1]], []));
        Assert.False(EpisodeLadderRules.IsPrefix([[5, 4, 3, 2, 1]], [[1, 2, 3, 4, 5]]));
    }

    internal static LadderEvent[] Catalog() =>
        Enumerable.Range(1, 73).SelectMany(episode => Enumerable.Range(1, 6).Select(story =>
            new LadderEvent(episode * 10 + story, "Test", null, (episode - 1) / 10 + 1, (episode - 1) % 10 + 1,
                episode, story * 5, 0, $"Story {story}"))).ToArray();

    private static int[] Gaps(LadderPuzzle puzzle)
    {
        var episodes = puzzle.Events.OrderBy(e => e.CorrectPosition).Select(e => e.EpisodeIndex).ToArray();
        return episodes.Zip(episodes.Skip(1), (previous, next) => next - previous - 1).ToArray();
    }

    [Theory]
    [InlineData(1, 15)]
    [InlineData(2, 10)]
    [InlineData(3, 6)]
    [InlineData(4, 4)]
    [InlineData(5, 0)]
    public void DailyAndRandomGenerationUseFiveDistinctEpisodesAndExactGaps(int difficulty, int totalGaps)
    {
        var catalog = Catalog();
        for (var gameId = 1; gameId <= 100; gameId++)
        {
            var reference = Puzzle(gameId).Game;
            var puzzle = EpisodeLadderRules.Generate(reference, catalog, difficulty)!;
            var repeated = EpisodeLadderRules.Generate(reference, catalog, difficulty)!;
            Assert.Equal(puzzle.Events, repeated.Events);
            foreach (var generated in new[] { puzzle, EpisodeLadderRules.GenerateRandom(catalog, difficulty)! })
            {
                Assert.Equal(difficulty, generated.Difficulty);
                Assert.Equal(5, generated.Events.Count);
                Assert.Equal(5, generated.Events.Select(e => e.EpisodeIndex).Distinct().Count());
                Assert.Equal(5, generated.Events.Select(e => (e.SeasonNumber, e.EpisodeNumber)).Distinct().Count());
                Assert.Equal(5, generated.Events.Select(e => e.Id).Distinct().Count());
                Assert.False(generated.Events.All(e => e.CorrectPosition == e.InitialPosition));
                Assert.All(Gaps(generated), gap => Assert.True(gap >= 0));
                Assert.Equal(totalGaps, Gaps(generated).Sum());
                if (difficulty == 5) Assert.All(Gaps(generated), gap => Assert.Equal(0, gap));
            }
        }
    }

    [Fact]
    public void ExpertSpacingVariesAndAllowsZeroGaps()
    {
        var catalog = Catalog();
        var gaps = Enumerable.Range(1, 300).Select(day => Gaps(EpisodeLadderRules.Generate(Puzzle(day).Game, catalog, 4)!)).ToArray();
        Assert.Contains(gaps, values => values.SequenceEqual(new[] { 1, 1, 1, 1 }));
        Assert.Contains(gaps, values => values.Contains(0) && values.Any(gap => gap > 1));
        Assert.Contains(gaps, values => values.Contains(4));
        Assert.True(gaps.Select(values => string.Join(',', values)).Distinct().Count() > 10);
    }

    [Fact]
    public void SparseCatalogUsesRealEpisodeGapsWithoutFallingBackToDuplicateEpisodes()
    {
        var catalog = Catalog().Where(e => new[] { 1, 2, 5, 6, 9 }.Contains(e.EpisodeIndex)).ToArray();
        var expert = EpisodeLadderRules.Generate(Puzzle().Game, catalog, 4)!;
        Assert.Equal(new[] { 0, 2, 0, 2 }, Gaps(expert));
        Assert.Null(EpisodeLadderRules.Generate(Puzzle().Game, catalog, 5));
        Assert.Null(EpisodeLadderRules.GenerateRandom(catalog, 1));
        Assert.Null(EpisodeLadderRules.Generate(Puzzle().Game, catalog.Where(e => e.EpisodeIndex != 9).ToArray(), 4));
    }

    [Fact]
    public void ImpossibleCanCrossASeasonBoundaryAndMinutesDoNotAffectOrdering()
    {
        var catalog = Enumerable.Range(0, 5).Select(index => new LadderEvent(index + 1, "Test", null,
            index < 2 ? 7 : 8, index < 2 ? 6 + index : index - 1, 66 + index, 59 - index, 45, null)).ToArray();
        var puzzle = EpisodeLadderRules.Generate(Puzzle().Game, catalog, 5)!;
        Assert.Equal(new[] { (7, 6), (7, 7), (8, 1), (8, 2), (8, 3) },
            puzzle.Events.OrderBy(e => e.CorrectPosition).Select(e => (e.SeasonNumber, e.EpisodeNumber)));
        Assert.Equal(new[] { 0, 0, 0, 0 }, Gaps(puzzle));
        var altered = EpisodeLadderRules.Generate(Puzzle().Game, catalog.Reverse().Select(e => e with { Minute = 0, Second = 0 }).ToArray(), 5)!;
        Assert.Equal(puzzle.Events.Select(e => (e.Id, e.CorrectPosition, e.InitialPosition)),
            altered.Events.Select(e => (e.Id, e.CorrectPosition, e.InitialPosition)));
        var won = EpisodeLadderRules.Replay(puzzle, [puzzle.Events.OrderBy(e => e.CorrectPosition).Select(e => e.Id).ToArray()]);
        Assert.Equal(59, won.Solution![0].Minute);
        Assert.Equal(45, won.Solution[0].Second);
    }

    [Fact]
    public void GenerationDoesNotMutateTheCatalogAndCanPickDifferentEventsWithinAnEpisode()
    {
        var catalog = Catalog().Where(e => e.EpisodeIndex <= 5).ToArray();
        var original = catalog.ToArray();
        var picked = Enumerable.Range(1, 50).Select(day => EpisodeLadderRules.Generate(Puzzle(day).Game, catalog, 5)!.Events[0].Id);
        Assert.True(picked.Distinct().Count() > 1);
        Assert.Equal(original, catalog);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    public void GenerationRejectsInvalidDifficulty(int difficulty)
    {
        Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.Generate(Puzzle().Game, Catalog(), difficulty));
        Assert.Throws<LadderValidationException>(() => EpisodeLadderRules.GenerateRandom(Catalog(), difficulty));
    }

    [Fact]
    public void IdenticalTimestampsCannotCreateAnAmbiguousPuzzle()
    {
        var ties = Enumerable.Range(1, 6).Select(id => new LadderEvent(id, "Test", null, 1, 1, 1, 10, 0, null)).ToArray();
        Assert.Null(EpisodeLadderRules.Generate(Puzzle().Game, ties, 5));
        Assert.Null(EpisodeLadderRules.Generate(Puzzle().Game, ties.Take(4).ToArray()));
    }
}
