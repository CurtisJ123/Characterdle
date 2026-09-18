using Characterdle.Server.Features.Admin;
using Characterdle.Server.Features.Premium;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class AdminPremiumCountsTests
{
    private static readonly DateTimeOffset Now = DateTimeOffset.Parse("2026-09-17T12:00:00Z");

    [Fact]
    public void GroupsCountEachAccountOnceAndKeepAccessSeparateFromSubscriptions()
    {
        var counts = new AdminPremiumCounts()
            .AddGroup(3, false, " Trialing ", false, Now.AddDays(3), null, null, true, Now)
            .AddGroup(2, true, "active", true, Now.AddDays(10), null, null, true, Now)
            .AddGroup(1, false, "past_due", false, Now.AddDays(10), null, null, true, Now)
            .AddGroup(4, true, "active", false, null, null, null, false, Now)
            .AddGroup(20, false, "inactive", false, null, null, null, false, Now);
        Assert.Equal(new AdminPremiumCounts(10, 3, 2, 1), counts);
    }

    [Fact]
    public void CanceledSubscriptionWithRemainingAccessIsNotAnActiveSubscription()
    {
        var counts = new AdminPremiumCounts()
            .AddGroup(1, false, "canceled", false, Now.AddDays(20), Now.AddDays(2), null, true, Now)
            .AddGroup(1, false, "canceled", true, Now.AddDays(2), null, null, true, Now)
            .AddGroup(1, false, "canceled", true, Now, null, null, true, Now);
        Assert.Equal(new AdminPremiumCounts(2), counts);
    }

    [Theory]
    [InlineData("trialing")]
    [InlineData("active")]
    public void EndedAccessIsNotCountedEvenWithStalePremiumFlag(string status)
    {
        var counts = new AdminPremiumCounts().AddGroup(1, true, status, false, Now.AddDays(10), null, Now, true, Now);
        Assert.Equal(new AdminPremiumCounts(), counts);
    }

    [Theory]
    [InlineData(null, false)]
    [InlineData("inactive", true)]
    [InlineData("past_due", false)]
    [InlineData("unpaid", false)]
    [InlineData("active", false)]
    public void PremiumTotalUsesExistingEntitlementRules(string? status, bool flag)
    {
        var expected = PremiumStatusEvaluator.HasPremiumAccess(flag, status, false, Now.AddDays(-1), null, null, Now);
        var counts = new AdminPremiumCounts().AddGroup(5, flag, status, false, Now.AddDays(-1), null, null, true, Now);
        Assert.Equal(expected ? 5L : 0L, counts.Users);
    }

    [Fact]
    public void EmptyStateIsZeroAndLargeCountsDoNotOverflowAnInt()
    {
        Assert.Equal(0, new AdminPremiumCounts().Users);
        var counts = new AdminPremiumCounts().AddGroup((long)int.MaxValue + 10, true, "active", false, null, null, null, true, Now);
        Assert.Equal((long)int.MaxValue + 10, counts.Users);
        Assert.Equal(counts.Users, counts.ActiveSubscriptions);
    }
}
