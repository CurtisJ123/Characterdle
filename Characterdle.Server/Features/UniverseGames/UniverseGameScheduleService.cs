using Microsoft.Extensions.DependencyInjection;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseGameScheduleService(
    IServiceScopeFactory scopeFactory,
    UniverseCatalog universeCatalog,
    ILogger<UniverseGameScheduleService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await EnsureGamesAreCurrentAsync(stoppingToken);
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

    private async Task EnsureGamesAreCurrentAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var repository = scope.ServiceProvider.GetRequiredService<IUniverseGameRepository>();
        var nowUtc = DateTimeOffset.UtcNow;

        foreach (var universe in universeCatalog.Universes)
        {
            var timeZone = UniverseGameTimeZoneResolver.Resolve(universe.ScheduleTimeZoneId);
            var todayLocalDate = ConvertUtcToLocalDate(nowUtc.UtcDateTime, timeZone);
            var latestGameUtc = await repository.GetMostRecentGameDateTimeUtcAsync(universe, cancellationToken);
            var latestLocalDate = latestGameUtc.HasValue
                ? ConvertUtcToLocalDate(latestGameUtc.Value, timeZone)
                : (DateOnly?)null;

            var nextScheduledDate = latestLocalDate?.AddDays(1) ?? todayLocalDate;

            if (nextScheduledDate > todayLocalDate)
            {
                logger.LogInformation(
                    "Universe {UniverseId} is current through {LatestLocalDate}.",
                    universe.Id,
                    latestLocalDate);
                continue;
            }

            var createdGames = 0;

            for (var scheduledDate = nextScheduledDate; scheduledDate <= todayLocalDate; scheduledDate = scheduledDate.AddDays(1))
            {
                var scheduledAtUtc = ConvertLocalDateMidnightToUtc(scheduledDate, timeZone);
                var selectionSeed = $"{universe.Id}:{scheduledDate:yyyy-MM-dd}";
                var result = await repository.CreateScheduledGameAsync(
                    universe,
                    scheduledAtUtc,
                    selectionSeed,
                    cancellationToken);

                if (!result.HasCharacters)
                {
                    logger.LogWarning(
                        "Universe {UniverseId} has no characters available, so the game scheduled for {ScheduledDate} could not be generated.",
                        universe.Id,
                        scheduledDate);
                    break;
                }

                if (result.Created)
                {
                    createdGames++;
                    logger.LogInformation(
                        "Generated universe game {GameId} for {UniverseId} on {ScheduledDate} ({ScheduledAtUtc:u}).",
                        result.GameId,
                        universe.Id,
                        scheduledDate,
                        scheduledAtUtc);
                }
                else if (result.AlreadyExists)
                {
                    logger.LogInformation(
                        "Universe game for {UniverseId} on {ScheduledDate} already exists.",
                        universe.Id,
                        scheduledDate);
                }
            }

            if (createdGames > 0)
            {
                logger.LogInformation(
                    "Generated {CreatedGames} scheduled game(s) for universe {UniverseId} through {TodayLocalDate}.",
                    createdGames,
                    universe.Id,
                    todayLocalDate);
            }
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

    private static DateOnly ConvertUtcToLocalDate(DateTime utcDateTime, TimeZoneInfo timeZone)
    {
        var utc = DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc);
        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, timeZone);
        return DateOnly.FromDateTime(local);
    }

    private static DateTime ConvertLocalDateMidnightToUtc(DateOnly localDate, TimeZoneInfo timeZone)
    {
        var localMidnight = localDate.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(localMidnight, timeZone);
    }
}
