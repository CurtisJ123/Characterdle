using Characterdle.Server.Configuration;
using Microsoft.Extensions.Options;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseGameScheduleService(
    UniverseGameScheduler scheduler,
    IOptions<SchedulingOptions> schedulingOptions,
    ILogger<UniverseGameScheduleService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!schedulingOptions.Value.EnableHostedService)
        {
            logger.LogInformation("Hosted universe game scheduling is disabled by configuration.");
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await scheduler.RunOnceAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Unable to ensure scheduled universe games are current.");
            }

            var delay = GetDelayUntilNextScheduledRunUtc(DateTimeOffset.UtcNow);

            logger.LogInformation(
                "Universe game scheduler sleeping for {Delay} until the next Eastern midnight run.",
                delay);

            await Task.Delay(delay, stoppingToken);
        }
    }

    private static TimeSpan GetDelayUntilNextScheduledRunUtc(DateTimeOffset nowUtc)
    {
        var easternTimeZone = UniverseGameTimeZoneResolver.Resolve("America/New_York");
        var localNow = TimeZoneInfo.ConvertTime(nowUtc, easternTimeZone);
        var nextRunDate = DateOnly.FromDateTime(localNow.DateTime).AddDays(1);
        var nextRunUtc = ConvertLocalDateMidnightToUtc(nextRunDate, easternTimeZone);
        var delay = nextRunUtc - nowUtc.UtcDateTime;

        return delay <= TimeSpan.Zero
            ? TimeSpan.FromMinutes(1)
            : delay;
    }

    private static DateTime ConvertLocalDateMidnightToUtc(DateOnly localDate, TimeZoneInfo timeZone)
    {
        var localMidnight = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, timeZone);
    }
}
