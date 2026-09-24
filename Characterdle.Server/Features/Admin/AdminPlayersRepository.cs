using Characterdle.Server.Features.EpisodeLadder;
using Characterdle.Server.Features.Leaderboard;
using Characterdle.Server.Features.Premium;
using Characterdle.Server.Features.UniverseGames;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Admin;

public sealed record AdminPlayerProfile(
    Guid Id, string DisplayName, string Email, string? AvatarUrl, DateTimeOffset CreatedAt,
    string Membership, DateTimeOffset? LastPlayedAt, int CurrentStreak, int LongestStreak,
    long CharacterAttempts, long CharacterWins, decimal CharacterWinRate, decimal? CharacterAverageGuesses,
    long QuoteAttempts, long QuoteWins, decimal QuoteWinRate, decimal? QuoteAverageGuesses,
    long LadderPoints, int LadderDaysPlayed, decimal LadderPointsPerDay);

public interface IAdminPlayersRepository
{
    Task<IReadOnlyList<AdminPlayerProfile>> GetAsync(CancellationToken ct);
}

public sealed class AdminPlayersRepository(NpgsqlDataSource dataSource, UniverseCatalog universes) : IAdminPlayersRepository
{
    // Aggregate each source separately to avoid multiplying attempts by progress/streak rows.
    // The completed-results view includes preserved Character/Quote attempts from earlier replays.
    internal const string Query = """
        with completed as (
          select user_id,
            count(*) filter (where mode='character') as character_attempts,
            count(*) filter (where mode='character' and status='won' and hint_count=0) as character_wins,
            round(avg(guess_count) filter (where mode='character' and status='won' and hint_count=0),2) as character_average,
            count(*) filter (where mode='quote') as quote_attempts,
            count(*) filter (where mode='quote' and status='won' and hint_count=0) as quote_wins,
            round(avg(guess_count) filter (where mode='quote' and status='won' and hint_count=0),2) as quote_average
          from public."UniverseCompletedGameResults"
          where universe_id=@universeId and mode in ('character','quote') and status in ('won','lost')
          group by user_id
        ), ladder as (
          select p.user_id,
            sum(case when p.status='won' then (@points)[(p.difficulty-1)*@maxAttempts+jsonb_array_length(p.attempts)] else 0 end)::bigint as points,
            count(distinct p.game_id)::int as days
          from public."GOTEpisodeLadderProgress" p join public."GOTGames" g on g.id=p.game_id
          where p.status in ('won','lost') and g.datetime<=now() and p.difficulty between 1 and 5
            and jsonb_array_length(p.attempts) between 1 and @maxAttempts
          group by p.user_id
        ), activity as (
          select user_id,max(played_at) as last_played_at from (
            select user_id,updated_at as played_at from public."UniverseGameResults"
              where universe_id=@universeId and mode in ('character','quote','episode_ladder')
            union all
            select user_id,updated_at from public."GOTEpisodeLadderProgress"
            union all
            select user_id,completed_at from public."UniverseCompletedGameResults"
              where universe_id=@universeId and mode in ('character','quote')
          ) gameplay group by user_id
        )
        select p.user_id,p.display_name,p.email,p.avatar_url,p.created_at,a.last_played_at,
          coalesce(case when s.last_credit_date >= (now() at time zone @timeZone)::date-1 then s.current_streak else 0 end,0) as current_streak,
          coalesce(s.longest_streak,0) as longest_streak,
          coalesce(c.character_attempts,0) as character_attempts,coalesce(c.character_wins,0) as character_wins,c.character_average,
          coalesce(c.quote_attempts,0) as quote_attempts,coalesce(c.quote_wins,0) as quote_wins,c.quote_average,
          coalesce(l.points,0) as ladder_points,coalesce(l.days,0) as ladder_days,
          coalesce(b.is_premium,false) as is_premium,b.status,coalesce(b.cancel_at_period_end,false) as cancel_at_period_end,
          b.current_period_end,b.cancel_at,b.premium_ended_at,now() as snapshot_at
        from public."PlayerProfiles" p
        left join completed c using(user_id)
        left join ladder l using(user_id)
        left join activity a using(user_id)
        left join public."UniverseStreaks" s on s.user_id=p.user_id and s.universe_id=@universeId
        left join public."UserPremiumStatus" b on b.user_id=p.user_id
        order by p.created_at desc,p.user_id;
        """;

    internal static decimal WinRate(long wins, long attempts) => attempts == 0 ? 0 : Math.Round(wins * 100m / attempts, 2);

    public async Task<IReadOnlyList<AdminPlayerProfile>> GetAsync(CancellationToken ct)
    {
        if (!universes.TryGet("got", out var universe)) throw new InvalidOperationException("Game of Thrones is not configured.");
        await using var command = dataSource.CreateCommand(Query);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("timeZone", universe.ScheduleTimeZoneId);
        command.Parameters.AddWithValue("points", NpgsqlDbType.Array | NpgsqlDbType.Integer, EpisodeLadderScoring.ScoreTable());
        command.Parameters.AddWithValue("maxAttempts", EpisodeLadderRules.MaxAttempts);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<AdminPlayerProfile>();
        while (await reader.ReadAsync(ct))
        {
            var premium = PremiumStatusEvaluator.HasPremiumAccess(reader.GetBoolean(16), reader.IsDBNull(17) ? null : reader.GetString(17),
                reader.GetBoolean(18), Date(reader,19), Date(reader,20), Date(reader,21), reader.GetFieldValue<DateTimeOffset>(22));
            var membership = !premium ? "Free" : !reader.IsDBNull(17) && reader.GetString(17).Trim().Equals("trialing",StringComparison.OrdinalIgnoreCase) ? "Trial" : "Premium";
            var characterAttempts = reader.GetInt64(8);
            var characterWins = reader.GetInt64(9);
            var quoteAttempts = reader.GetInt64(11);
            var quoteWins = reader.GetInt64(12);
            var points = reader.GetInt64(14);
            var days = reader.GetInt32(15);
            rows.Add(new(reader.GetGuid(0),reader.GetString(1),reader.GetString(2),SafeAvatar(reader.IsDBNull(3) ? null : reader.GetString(3)),
                reader.GetFieldValue<DateTimeOffset>(4),membership,Date(reader,5),reader.GetInt32(6),reader.GetInt32(7),
                characterAttempts,characterWins,WinRate(characterWins,characterAttempts),reader.IsDBNull(10) ? null : reader.GetDecimal(10),
                quoteAttempts,quoteWins,WinRate(quoteWins,quoteAttempts),reader.IsDBNull(13) ? null : reader.GetDecimal(13),
                points,days,days == 0 ? 0 : Math.Round(points/(decimal)days,2)));
        }
        return rows;
    }

    private static DateTimeOffset? Date(NpgsqlDataReader reader, int index) => reader.IsDBNull(index) ? null : reader.GetFieldValue<DateTimeOffset>(index);
    private static string? SafeAvatar(string? value) => value is not null &&
        ((value.StartsWith("/images/",StringComparison.Ordinal) && !value.Contains('\\'))
        || (Uri.TryCreate(value,UriKind.Absolute,out var uri) && uri.Scheme == Uri.UriSchemeHttps)) ? value : null;
}
