using Characterdle.Server.Features.UniverseGames;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Leaderboard;

public static class DailyStreakCreditCommand
{
    // Execute after saving the result, on the same connection and transaction.
    // Future daily modes can reuse this without crediting temporary random rounds.
    public static NpgsqlCommand Create(UniverseDefinition universe, Guid userId, long gameId, string mode)
    {
        var sql = $"""
            with new_credit as (
              insert into public."UniverseStreakCredits" (
                user_id, universe_id, game_id, result_id, credit_date, credit_type
              )
              select
                results.user_id,
                results.universe_id,
                results.game_id,
                results.id,
                (games.datetime at time zone @scheduleTimeZoneId)::date,
                'daily_completion'
              from public."UniverseGameResults" as results
              join {universe.GameTableName} as games on games.id = results.game_id
              where results.user_id = @userId
                and results.universe_id = @universeId
                and results.game_id = @gameId
                and results.mode = @mode
                and results.status in ('won', 'lost')
                and (games.datetime at time zone @scheduleTimeZoneId)::date
                  = (now() at time zone @scheduleTimeZoneId)::date
              on conflict do nothing
              returning user_id, universe_id, credit_date
            )
            insert into public."UniverseStreaks" (
              user_id, universe_id, current_streak, longest_streak, last_credit_date, updated_at
            )
            select user_id, universe_id, 1, 1, credit_date, timezone('utc', now())
            from new_credit
            on conflict (user_id, universe_id) do update
            set
              current_streak = case
                when public."UniverseStreaks".last_credit_date = excluded.last_credit_date
                  then public."UniverseStreaks".current_streak
                when public."UniverseStreaks".last_credit_date = excluded.last_credit_date - 1
                  then public."UniverseStreaks".current_streak + 1
                else 1
              end,
              longest_streak = greatest(
                public."UniverseStreaks".longest_streak,
                case
                  when public."UniverseStreaks".last_credit_date = excluded.last_credit_date
                    then public."UniverseStreaks".current_streak
                  when public."UniverseStreaks".last_credit_date = excluded.last_credit_date - 1
                    then public."UniverseStreaks".current_streak + 1
                  else 1
                end
              ),
              last_credit_date = greatest(public."UniverseStreaks".last_credit_date, excluded.last_credit_date),
              updated_at = excluded.updated_at;
            """;

        // Only a newly inserted day credit can advance the summary, including concurrent mode completions.
        var command = new NpgsqlCommand(sql);
        command.Parameters.AddWithValue("userId", NpgsqlDbType.Uuid, userId);
        command.Parameters.AddWithValue("universeId", NpgsqlDbType.Text, universe.Id);
        command.Parameters.AddWithValue("gameId", NpgsqlDbType.Bigint, gameId);
        command.Parameters.AddWithValue("mode", NpgsqlDbType.Text, mode);
        command.Parameters.AddWithValue("scheduleTimeZoneId", NpgsqlDbType.Text, universe.ScheduleTimeZoneId);
        return command;
    }
}
