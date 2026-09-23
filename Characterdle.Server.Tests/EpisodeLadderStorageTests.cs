using Characterdle.Server.Features.EpisodeLadder;
using Npgsql;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class EpisodeLadderStorageTests
{
    [Fact]
    public void InsertBatchPacksAllFiveDifficultiesWithoutChildRows()
    {
        using var connection = new NpgsqlConnection();
        var puzzles = Enumerable.Range(1, 5).Select(level => EpisodeLadderRulesTests.Puzzle() with { Difficulty = level }).ToArray();
        // No connection or transaction is opened: verify command shape and ordering only.
        using var batch = EpisodeLadderRepository.CreatePuzzleInsertBatch(connection, null!, puzzles);
        Assert.Equal(5, batch.BatchCommands.Count);
        foreach (var command in batch.BatchCommands)
        {
            Assert.Contains("answer_event_ids, initial_order", command.CommandText);
            Assert.DoesNotContain("GOTEpisodeLadderGameEvents", command.CommandText);
            Assert.Equal(new long[] { 1, 2, 3, 4, 5 }, Assert.IsType<long[]>(command.Parameters["answers"].Value));
            Assert.Equal(new short[] { 5, 4, 3, 2, 1 }, Assert.IsType<short[]>(command.Parameters["initial"].Value));
        }
    }

    [Fact]
    public void PackingDoesNotDependOnTheOrderOfHydratedEvents()
    {
        using var connection = new NpgsqlConnection();
        var puzzle = EpisodeLadderRulesTests.Puzzle();
        using var batch = EpisodeLadderRepository.CreatePuzzleInsertBatch(connection, null!,
            [puzzle with { Events = puzzle.Events.Reverse().ToArray() }]);
        Assert.Equal(new long[] { 1, 2, 3, 4, 5 }, Assert.IsType<long[]>(batch.BatchCommands[0].Parameters["answers"].Value));
        Assert.Equal(new short[] { 5, 4, 3, 2, 1 }, Assert.IsType<short[]>(batch.BatchCommands[0].Parameters["initial"].Value));
    }
}
