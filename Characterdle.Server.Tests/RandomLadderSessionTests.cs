using Characterdle.Server.Features.EpisodeLadder;
using Microsoft.AspNetCore.DataProtection;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class RandomLadderSessionTests
{
    private readonly Guid _user = Guid.NewGuid();
    private readonly Clock _clock = new();
    private readonly IDataProtectionProvider _protection = new EphemeralDataProtectionProvider();
    private RandomLadderSession Sessions => new(_protection, _clock);

    [Fact]
    public void HiddenAnswerAndLockedEventsAreServerControlled()
    {
        var round = Sessions.Start(EpisodeLadderRulesTests.Puzzle(), _user);
        Assert.Null(round.Game.Solution);
        Assert.DoesNotContain("CorrectPosition", round.RoundToken);
        round = Sessions.Submit(round.RoundToken, [5, 4, 3, 2, 1], _user);
        Assert.Equal(new[] { 2 }, round.Game.LockedPositions);
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 2, 4, 3, 5], _user));
        round = Sessions.Submit(round.RoundToken, [1, 2, 3, 4, 5], _user);
        Assert.Equal("won", round.Game.Status);
        Assert.NotNull(round.Game.Solution);
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 2, 3, 4, 5], _user));
    }

    [Fact]
    public void RejectsOtherUsersTamperingExpiredRoundsAndInvalidOrders()
    {
        var round = Sessions.Start(EpisodeLadderRulesTests.Puzzle(), _user);
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 2, 3, 4, 5], Guid.NewGuid()));
        Assert.Throws<LadderValidationException>(() => Sessions.Submit("broken" + round.RoundToken, [1, 2, 3, 4, 5], _user));
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 1, 2, 3, 4], _user));
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 2, 3, 4, 99], _user));
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, null, _user));
        _clock.Now = _clock.Now.AddHours(6);
        Assert.Throws<LadderValidationException>(() => Sessions.Submit(round.RoundToken, [1, 2, 3, 4, 5], _user));
    }

    [Fact]
    public void RandomGenerationIsNotSeededByTheDailyGameNumber()
    {
        var catalog = EpisodeLadderRulesTests.Catalog();
        var rounds = Enumerable.Range(0, 20).Select(_ => EpisodeLadderRules.GenerateRandom(catalog)!).ToArray();
        Assert.All(rounds, puzzle => { Assert.Equal(0, puzzle.Game.Id); Assert.Equal(5, puzzle.Events.Count); });
        Assert.True(rounds.Select(p => string.Join(',', p.Events.Select(e => e.Id))).Distinct().Count() > 1);
    }

    private sealed class Clock : TimeProvider
    {
        public DateTimeOffset Now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => Now;
    }
}
