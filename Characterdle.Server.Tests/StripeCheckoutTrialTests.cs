using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Billing;
using Characterdle.Server.Features.Leaderboard;
using Microsoft.Extensions.Options;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class StripeCheckoutTrialTests
{
    [Theory]
    [InlineData(BillingCheckoutPlan.Monthly, true, 3, 3, 3L)]
    [InlineData(BillingCheckoutPlan.Yearly, true, 3, 3, 3L)]
    [InlineData(BillingCheckoutPlan.Monthly, true, 7, 14, 7L)]
    [InlineData(BillingCheckoutPlan.Yearly, true, 7, 14, 14L)]
    [InlineData(BillingCheckoutPlan.Monthly, false, 3, 3, null)]
    [InlineData(BillingCheckoutPlan.Yearly, false, 3, 3, null)]
    [InlineData(BillingCheckoutPlan.Monthly, true, 0, 3, null)]
    [InlineData(BillingCheckoutPlan.Yearly, true, 3, 0, null)]
    [InlineData(BillingCheckoutPlan.Monthly, true, -1, 3, null)]
    [InlineData(BillingCheckoutPlan.Yearly, true, 3, -1, null)]
    public void TrialLengthComesFromTheSelectedPlanAndRequiresEligibility(
        BillingCheckoutPlan plan, bool eligible, int monthlyDays, int yearlyDays, long? expected)
    {
        var options = new StripeOptions
        {
            MonthlyPriceId = "price_test_monthly",
            YearlyPriceId = "price_test_yearly",
            MonthlyTrialDays = monthlyDays,
            YearlyTrialDays = yearlyDays,
            SuccessUrl = "https://staging.example.test/premium?billing=success",
            CancelUrl = "https://staging.example.test/premium?billing=cancelled",
        };
        var service = new StripeBillingService(Options.Create(options));
        var user = new VerifiedSupabaseUser(Guid.NewGuid(), "Test Player", "test@example.test", null);
        var session = service.BuildCheckoutOptions(user, "cus_test", plan, eligible);

        Assert.Equal(expected, session.SubscriptionData.TrialPeriodDays);
        Assert.Equal("subscription", session.Mode);
        Assert.Equal(plan == BillingCheckoutPlan.Yearly ? options.YearlyPriceId : options.MonthlyPriceId,
            Assert.Single(session.LineItems).Price);
        Assert.Equal(1, session.LineItems[0].Quantity);
        Assert.Equal(user.UserId.ToString(), session.ClientReferenceId);
        Assert.Equal("cus_test", session.Customer);
        Assert.Equal(plan == BillingCheckoutPlan.Yearly ? "yearly" : "monthly",
            session.SubscriptionData.Metadata["characterdle_plan"]);
        Assert.Equal(user.UserId.ToString(), session.SubscriptionData.Metadata["characterdle_user_id"]);
        Assert.Equal(options.SuccessUrl, session.SuccessUrl);
        Assert.Equal(options.CancelUrl, session.CancelUrl);
        Assert.NotEqual("if_required", session.PaymentMethodCollection);
    }
}
