using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public sealed class UniverseGameScheduler(
    IServiceScopeFactory scopeFactory,
    NpgsqlDataSource dataSource,
    UniverseCatalog universeCatalog,
    ILogger<UniverseGameScheduler> logger)
{
    private const long SchedulerLockId = 1486116305;

    public async Task RunOnceAsync(CancellationToken cancellationToken)
    {
        await using var lockConnection = await dataSource.OpenConnectionAsync(cancellationToken);
        var lockAcquired = await TryAcquireLockAsync(lockConnection, cancellationToken);

        if (!lockAcquired)
        {
            logger.LogInformation("Skipped scheduled universe game generation because another instance already holds the scheduler lock.");
            return;
        }

        logger.LogInformation("Acquired universe game scheduler lock.");

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

    private static async Task<bool> TryAcquireLockAsync(
        NpgsqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            "select pg_try_advisory_lock(@lockId);",
            connection);
        command.Parameters.AddWithValue("lockId", SchedulerLockId);

        return await command.ExecuteScalarAsync(cancellationToken) is true;
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
