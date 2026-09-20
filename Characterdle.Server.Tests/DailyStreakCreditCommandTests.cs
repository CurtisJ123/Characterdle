using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.UniverseGames;
using NpgsqlTypes;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class DailyStreakCreditCommandTests
{
    private static readonly UniverseDefinition Universe = UniverseCatalog.CreateDefault().Universes[0];

    [Theory]
    [InlineData("character")]
    [InlineData("quote")]
    [InlineData("episode_ladder")]
    public void CompletionQueryScopesThePersistedResultToTheRequestedMode(string mode)
    {
        var userId = Guid.NewGuid();
        using var command = DailyStreakCreditCommand.Create(Universe, userId, 50, mode);
        Assert.Contains("results.user_id = @userId", command.CommandText);
        Assert.Contains("results.universe_id = @universeId", command.CommandText);
        Assert.Contains("results.game_id = @gameId", command.CommandText);
        Assert.Contains("results.mode = @mode", command.CommandText);
        Assert.DoesNotContain("results.mode = 'character'", command.CommandText);
        Assert.Equal(userId, command.Parameters["userId"].Value);
        Assert.Equal("got", command.Parameters["universeId"].Value);
        Assert.Equal(50L, command.Parameters["gameId"].Value);
        Assert.Equal(mode, command.Parameters["mode"].Value);
    }

    [Fact]
    public void QueryRequiresAStoredCompletedDailyGameAndUsesTheUniverseTimeZone()
    {
        using var command = DailyStreakCreditCommand.Create(Universe, Guid.NewGuid(), 50, "quote");
        Assert.Contains("from public.\"UniverseGameResults\" as results", command.CommandText);
        Assert.Contains("join public.\"GOTGames\" as games on games.id = results.game_id", command.CommandText);
        Assert.Contains("results.status in ('won', 'lost')", command.CommandText);
        Assert.Contains("(games.datetime at time zone @scheduleTimeZoneId)::date", command.CommandText);
        Assert.Contains("= (now() at time zone @scheduleTimeZoneId)::date", command.CommandText);
        Assert.Equal(Universe.ScheduleTimeZoneId, command.Parameters["scheduleTimeZoneId"].Value);
        Assert.DoesNotContain("hint_count", command.CommandText);
    }

    [Fact]
    public void SummaryQueryOnlyConsumesNewCreditsAndRetainsDailyConflictProtection()
    {
        using var command = DailyStreakCreditCommand.Create(Universe, Guid.NewGuid(), 50, "quote");
        Assert.Contains("with new_credit as (", command.CommandText);
        Assert.Contains("on conflict do nothing", command.CommandText);
        Assert.Contains("returning user_id, universe_id, credit_date", command.CommandText);
        Assert.Contains("from new_credit", command.CommandText);
        Assert.Contains("on conflict (user_id, universe_id) do update", command.CommandText);
        Assert.Contains("last_credit_date = excluded.last_credit_date - 1", command.CommandText);
        Assert.Contains("longest_streak = greatest(", command.CommandText);
    }

    [Fact]
    public void ValuesAreBoundAsParametersNotInsertedIntoSql()
    {
        const string untrustedMode = "quote'; delete from public.\"UniverseStreaks\"; --";
        using var command = DailyStreakCreditCommand.Create(Universe, Guid.NewGuid(), 50, untrustedMode);
        Assert.DoesNotContain(untrustedMode, command.CommandText);
        Assert.Equal(untrustedMode, command.Parameters["mode"].Value);
        Assert.Equal(NpgsqlDbType.Text, command.Parameters["mode"].NpgsqlDbType);
        Assert.Equal(NpgsqlDbType.Uuid, command.Parameters["userId"].NpgsqlDbType);
        Assert.Equal(NpgsqlDbType.Bigint, command.Parameters["gameId"].NpgsqlDbType);
    }
}
