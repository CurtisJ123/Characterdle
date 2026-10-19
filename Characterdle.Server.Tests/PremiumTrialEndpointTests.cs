using System.Net;
using System.Net.Http.Json;
using Characterdle.Server.Configuration;
using Characterdle.Server.Features.Billing;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Features.UniverseGames;
using Characterdle.Server.Infrastructure.Auth;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Characterdle.Server.Tests;

public sealed class PremiumTrialEndpointTests
{
    [Theory]
    [InlineData(false, false, 3, 3)]
    [InlineData(false, true, 3, 0)]
    [InlineData(true, true, 3, 0)]
    [InlineData(true, false, 3, 0)]
    [InlineData(false, false, 0, 0)]
    [InlineData(false, false, -1, 0)]
    [InlineData(false, false, 7, 7)]
    public async Task OfferUsesCheckoutHistoryAndConfiguredTrialLength(bool active, bool started, int days, int expected)
    {
        var user = new UserStub();
        var billing = new BillingStub { Started = started };
        await using var app = CreateApp(user, billing, active, days);
        await app.StartAsync();
        using var client = app.GetTestClient();
        var response = await client.GetAsync("/api/premium");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.CacheControl!.NoStore);
        Assert.Contains("Authorization", response.Headers.Vary);
        var result = (await response.Content.ReadFromJsonAsync<PremiumStateResponse>())!;
        Assert.Equal(expected, result.Access.MonthlyTrialDays);
        Assert.Equal(active, result.Access.IsPremium);
        Assert.Equal(!active && days > 0 ? user.User!.UserId : null, billing.LastUser);
    }

    [Fact]
    public async Task GuestsCannotReadAccountEligibility()
    {
        var billing = new BillingStub();
        await using var app = CreateApp(new UserStub { User = null }, billing, false, 3, 3);
        await app.StartAsync();
        using var client = app.GetTestClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/premium")).StatusCode);
        Assert.Null(billing.LastUser);
    }

    [Theory]
    [InlineData(3, 0)]
    [InlineData(0, 3)]
    [InlineData(3, 3)]
    public async Task HistoryFailureDoesNotAdvertiseATrial(int monthlyDays, int yearlyDays)
    {
        await using var app = CreateApp(new UserStub(), new BillingStub { Fail = true }, false, monthlyDays, yearlyDays);
        await app.StartAsync();
        using var client = app.GetTestClient();
        Assert.Equal(HttpStatusCode.ServiceUnavailable, (await client.GetAsync("/api/premium")).StatusCode);
    }

    [Theory]
    [InlineData(false, false, 3, 3, 3, 3)]
    [InlineData(false, false, 0, 3, 0, 3)]
    [InlineData(false, false, 3, 0, 3, 0)]
    [InlineData(false, false, 7, 14, 7, 14)]
    [InlineData(false, true, 3, 3, 0, 0)]
    [InlineData(true, true, 3, 3, 0, 0)]
    [InlineData(true, false, 3, 3, 0, 0)]
    [InlineData(false, false, -1, 3, 0, 3)]
    [InlineData(false, false, 3, -1, 3, 0)]
    [InlineData(false, false, 0, 0, 0, 0)]
    public async Task BothPlansShareOneHistoryCheck(bool active, bool started,
        int monthlyDays, int yearlyDays, int expectedMonthly, int expectedYearly)
    {
        var user = new UserStub();
        var billing = new BillingStub { Started = started };
        await using var app = CreateApp(user, billing, active, monthlyDays, yearlyDays);
        await app.StartAsync();
        using var client = app.GetTestClient();
        var result = (await client.GetFromJsonAsync<PremiumStateResponse>("/api/premium"))!;
        Assert.Equal(expectedMonthly, result.Access.MonthlyTrialDays);
        Assert.Equal(expectedYearly, result.Access.YearlyTrialDays);
        var needsHistory = !active && (monthlyDays > 0 || yearlyDays > 0);
        Assert.Equal(needsHistory ? 1 : 0, billing.HistoryCalls);
        Assert.Equal(needsHistory ? user.User!.UserId : null, billing.LastUser);
    }

    private static WebApplication CreateApp(UserStub user, BillingStub billing, bool active, int days, int yearlyDays = 0)
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { EnvironmentName = "Testing" });
        builder.WebHost.UseTestServer();
        builder.Services.AddSingleton<ICurrentSupabaseUserAccessor>(user);
        builder.Services.AddSingleton<IPremiumRepository>(new PremiumStub(active));
        builder.Services.AddSingleton<IBillingRepository>(billing);
        builder.Services.AddSingleton<ILeaderboardRepository>(new ProfileStub());
        builder.Services.Configure<StripeOptions>(options =>
        {
            options.MonthlyTrialDays = days;
            options.YearlyTrialDays = yearlyDays;
        });
        var app = builder.Build();
        app.MapPremiumEndpoints();
        return app;
    }

    private sealed class UserStub : ICurrentSupabaseUserAccessor
    {
        public VerifiedSupabaseUser? User = new(Guid.NewGuid(), "Player", "player@example.test", null);
        public Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken ct) => Task.FromResult(User);
    }

    private sealed class PremiumStub(bool active) : IPremiumRepository
    {
        public Task<PremiumStateResponse> GetPremiumStateAsync(Guid userId, CancellationToken ct) =>
            Task.FromResult(new PremiumStateResponse(new PremiumAccessResponse(active, null, null, null, null,
                null, null, null, false, null, active, active, active, active, active, 3, active, 1, 0, true)));
        public Task<PremiumAccessResponse> GetPremiumAccessAsync(Guid userId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> HasActiveSubscriptionAsync(Guid userId, CancellationToken ct) => throw new NotSupportedException();
    }

    private sealed class BillingStub : IBillingRepository
    {
        public bool Started;
        public bool Fail;
        public Guid? LastUser;
        public int HistoryCalls;
        public Task<bool> HasStartedPremiumAsync(Guid userId, CancellationToken ct)
        {
            HistoryCalls++;
            LastUser = userId;
            if (Fail) throw new InvalidOperationException("History unavailable");
            return Task.FromResult(Started);
        }
        public Task<string?> GetStripeCustomerIdAsync(Guid userId, CancellationToken ct) => throw new NotSupportedException();
        public Task<Guid?> GetUserIdByStripeCustomerIdAsync(string customerId, CancellationToken ct) => throw new NotSupportedException();
        public Task<bool> HasProcessedWebhookEventAsync(string eventId, CancellationToken ct) => throw new NotSupportedException();
        public Task UpsertStripeCustomerIdAsync(Guid userId, string customerId, CancellationToken ct) => throw new NotSupportedException();
        public Task UpsertPremiumStatusAsync(Guid userId, StripePremiumStatusSnapshot snapshot, CancellationToken ct) => throw new NotSupportedException();
        public Task RecordProcessedWebhookEventAsync(string eventId, string eventType, CancellationToken ct) => throw new NotSupportedException();
    }

    private sealed class ProfileStub : ILeaderboardRepository
    {
        public Task EnsurePlayerProfileAsync(VerifiedSupabaseUser user, CancellationToken ct) => Task.CompletedTask;
        public Task<bool> GameExistsAsync(UniverseDefinition universe, long gameId, CancellationToken ct) => throw new NotSupportedException();
        public Task<UniverseLeaderboardResponse> GetLeaderboardAsync(UniverseDefinition universe, Guid? userId, int limit, CancellationToken ct, Guid? visibilityUserId = null) => throw new NotSupportedException();
        public Task<UniverseStreakResponse> UpsertUniverseGameResultAsync(Guid userId, UniverseDefinition universe, long gameId, int guesses, int hints,
            string mode, string status, IReadOnlyList<long> ids, IReadOnlyList<string> keys, int attemptNumber, CancellationToken ct) => throw new NotSupportedException();
    }
}
