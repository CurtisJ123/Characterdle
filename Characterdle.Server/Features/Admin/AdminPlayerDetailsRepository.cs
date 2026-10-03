using System.Text.Json;
using Characterdle.Server.Features.EpisodeLadder;
using Characterdle.Server.Features.Leaderboard;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Admin;

public sealed class AdminPlayerDetailsRepository(NpgsqlDataSource source, IAdminPlayersRepository players,
    IPlayerModerationRepository moderation) : IAdminPlayerDetailsRepository
{
    public async Task<AdminPlayerDetails?> GetAsync(Guid userId, Guid actorId, CancellationToken ct)
    {
        var profile = await players.GetOneAsync(userId, ct);
        if (profile is null) return null;
        var state = await moderation.GetAsync(userId, ct);
        await using var command = source.CreateCommand("""
            select exists(select 1 from public."AdminUsers" where user_id=@userId),
              b.status,b.current_period_start,b.current_period_end,coalesce(b.cancel_at_period_end,false),b.cancel_at,
              (select coalesce(round(100.0*count(*) filter(where p.status='won' and jsonb_array_length(p.attempts)=1)
                /nullif(count(*),0),2),0) from public."GOTEpisodeLadderProgress" p
                join public."GOTGames" g on g.id=p.game_id
                where p.user_id=@userId and p.status in ('won','lost') and g.datetime<=now()
                  and p.difficulty between 1 and 5 and jsonb_array_length(p.attempts) between 1 and @maxAttempts)
            from (select 1) seed left join public."UserPremiumStatus" b on b.user_id=@userId
            """);
        command.Parameters.AddWithValue("userId", userId); command.Parameters.AddWithValue("maxAttempts", EpisodeLadderRules.MaxAttempts);
        await using var reader = await command.ExecuteReaderAsync(ct); await reader.ReadAsync(ct);
        var isAdmin = reader.GetBoolean(0);
        return new(profile, state, isAdmin, !isAdmin && userId != actorId,
            new(reader.IsDBNull(1) ? null : reader.GetString(1), Date(reader,2), Date(reader,3), reader.GetBoolean(4), Date(reader,5)), reader.GetDecimal(6));
    }

    internal const string GamesQuery = """
        with history as (
          select universe_id,game_id,mode,status,guess_count,hint_count,completed_at,
            null::int as difficulty,null::int as points,null::jsonb as attempts
          from public."UniverseCompletedGameResults"
          where user_id=@userId and mode in ('character','quote') and status in ('won','lost')
          union all
          select universe_id,game_id,mode,status,guess_count,hint_count,updated_at,
            null::int,null::int,null::jsonb from public."UniverseGameResults"
          where user_id=@userId and mode in ('character','quote') and status='playing'
          union all
          select 'got',p.game_id,'episode_ladder',p.status,jsonb_array_length(p.attempts),0,p.updated_at,
            p.difficulty::int,case when p.status='won' then (@points)[(p.difficulty-1)*@maxAttempts+jsonb_array_length(p.attempts)] else 0 end,p.attempts
          from public."GOTEpisodeLadderProgress" p join public."GOTGames" g on g.id=p.game_id
          where p.user_id=@userId and g.datetime<=now() and p.difficulty between 1 and 5
            and jsonb_array_length(p.attempts) between 0 and @maxAttempts
        )
        select universe_id,game_id,mode,status,guess_count,hint_count,completed_at,difficulty,points,attempts::text,
          case when mode='episode_ladder' then sum(points) over(partition by universe_id,game_id,mode) end as daily_points
        from history where @mode='all' or mode=@mode
        order by completed_at desc nulls last,universe_id,game_id desc,mode,difficulty nulls first
        offset @offset limit 26
        """;

    public async Task<AdminPageResult<AdminGameHistory>> GamesAsync(Guid userId, string mode, int page, CancellationToken ct)
    {
        await using var command = source.CreateCommand(GamesQuery);
        command.Parameters.AddWithValue("userId", userId); command.Parameters.AddWithValue("mode", mode);
        command.Parameters.AddWithValue("offset", (page-1)*25);
        command.Parameters.AddWithValue("points", NpgsqlDbType.Array | NpgsqlDbType.Integer, EpisodeLadderScoring.ScoreTable());
        command.Parameters.AddWithValue("maxAttempts", EpisodeLadderRules.MaxAttempts);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<AdminGameHistory>();
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetString(0),reader.GetInt64(1),reader.GetString(2),reader.GetString(3),
            reader.GetInt32(4),reader.GetInt32(5),Date(reader,6),reader.IsDBNull(7) ? null : reader.GetInt32(7),reader.IsDBNull(8) ? null : reader.GetInt32(8),
            reader.IsDBNull(9) ? null : JsonSerializer.Deserialize<long[][]>(reader.GetString(9)),reader.IsDBNull(10) ? null : reader.GetInt64(10)));
        return new(rows.Take(25).ToArray(),page,rows.Count>25);
    }

    // This is a bounded investigation of stored summaries, NOT a time-to-solve or identity claim.
    internal const string ActivityCte = """
        with recent as materialized (
          select * from public."UniverseGamePlays" where participant_key=@userKey
          order by updated_at desc,universe_id,mode,game_id desc limit 1000
        ), matches as (
          select r.universe_id,r.game_id,r.mode,r.status,r.guess_count,r.updated_at,r.completed_at,
            g.participant_key as guest_key,g.status as guest_status,g.guess_count as guest_guesses,
            g.completed_at as guest_completed_at,extract(epoch from (r.completed_at-g.completed_at))::double precision as seconds_before
          from recent r left join lateral (
            select guest.participant_key,guest.status,guest.guess_count,guest.completed_at
            from public."UniverseGamePlays" guest
            where guest.universe_id=r.universe_id and guest.mode=r.mode and guest.game_id=r.game_id
              and guest.participant_key like 'guest:%' and guest.status in ('won','lost')
              and guest.completed_at is not null and guest.completed_at<r.completed_at
              and (@guestKey is null or guest.participant_key=@guestKey)
            order by guest.completed_at desc,guest.participant_key limit 1
          ) g on true
          where @guestKey is null or g.participant_key is not null
        )
        """;

    public async Task<AdminActivityPage> ActivityAsync(Guid userId, Guid? guestId, int page, CancellationToken ct)
    {
        var rows = new List<AdminActivity>();
        var repeated = new List<RepeatedGuestMatch>();
        await using var command = source.CreateCommand(ActivityCte + """
            select * from matches order by updated_at desc,universe_id,mode,game_id desc offset @offset limit 26;
            """ + ActivityCte + """
            select guest_key,count(*),max(guest_completed_at) from matches where guest_key is not null
            group by guest_key order by count(*) desc,guest_key limit 25;
            """);
        command.Parameters.AddWithValue("userKey", $"user:{userId}");
        command.Parameters.AddWithValue("guestKey", NpgsqlDbType.Text, guestId.HasValue ? $"guest:{guestId}" : DBNull.Value);
        command.Parameters.AddWithValue("offset", (page-1)*25);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetString(0),reader.GetInt64(1),reader.GetString(2),
            reader.IsDBNull(3) ? null : reader.GetString(3),reader.GetInt32(4),reader.GetFieldValue<DateTimeOffset>(5),Date(reader,6),
            reader.IsDBNull(7) ? null : reader.GetString(7),reader.IsDBNull(8) ? null : reader.GetString(8),
            reader.IsDBNull(9) ? null : reader.GetInt32(9),Date(reader,10),reader.IsDBNull(11) ? null : reader.GetDouble(11)));
        await reader.NextResultAsync(ct);
        while (await reader.ReadAsync(ct)) repeated.Add(new(reader.GetString(0),reader.GetInt64(1),reader.GetFieldValue<DateTimeOffset>(2)));
        return new(new(rows.Take(25).ToArray(),page,rows.Count>25),repeated);
    }
    private static DateTimeOffset? Date(NpgsqlDataReader reader, int i) => PlayerModerationRepository.Date(reader,i);
}
