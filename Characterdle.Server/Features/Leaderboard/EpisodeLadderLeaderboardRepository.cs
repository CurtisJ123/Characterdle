using Characterdle.Server.Features.EpisodeLadder;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Leaderboard;

public sealed record EpisodeLadderLeaderboardEntry(
    long Rank, Guid UserId, string DisplayName, string? AvatarUrl, bool ShowSupporterBadge,
    long TotalPoints, int DaysPlayed, decimal PointsPerDay, bool IsCurrentUser);

public sealed record EpisodeLadderLeaderboardOverview(int PlayerCount, long TotalPoints, long DaysPlayed, decimal PointsPerDay);

public sealed record EpisodeLadderLeaderboardResponse(
    EpisodeLadderLeaderboardOverview Overview, IReadOnlyList<EpisodeLadderLeaderboardEntry> Rows,
    EpisodeLadderLeaderboardEntry? CurrentUser);

public interface IEpisodeLadderLeaderboardRepository
{
    Task<EpisodeLadderLeaderboardResponse> GetAsync(Guid? currentUserId, int limit, CancellationToken cancellationToken);
}

public sealed class EpisodeLadderLeaderboardRepository(NpgsqlDataSource dataSource) : IEpisodeLadderLeaderboardRepository
{
    internal const string Query = """
        with completed as (
            select progress.user_id, progress.game_id,
                case when progress.status = 'won'
                    then (@points)[(progress.difficulty - 1) * @maxAttempts + jsonb_array_length(progress.attempts)]
                    else 0 end as points
            from public."GOTEpisodeLadderProgress" progress
            join public."GOTGames" games on games.id = progress.game_id
            where progress.status in ('won', 'lost') and games.datetime <= now()
                and progress.difficulty between 1 and 5
                and jsonb_array_length(progress.attempts) between 1 and @maxAttempts
        ), aggregated as (
            select user_id, sum(points)::bigint as total_points, count(distinct game_id)::int as days_played
            from completed group by user_id
        ), players as (
            select aggregated.*, profiles.display_name, profiles.avatar_url,
                coalesce(premium.is_premium, false) as show_supporter_badge,
                round(total_points::numeric / days_played, 2) as points_per_day
            from aggregated
            join public."PlayerProfiles" profiles using (user_id)
            left join public."UserPremiumStatus" premium using (user_id)
        ), ranked as (
            select players.*,
                dense_rank() over (order by total_points desc) as rank,
                row_number() over (order by total_points desc, display_name, user_id) as position
            from players
        ), overview as (
            select count(*)::int as player_count, coalesce(sum(total_points), 0)::bigint as total_points,
                coalesce(sum(days_played), 0)::bigint as days_played,
                coalesce(round(sum(total_points)::numeric / nullif(sum(days_played), 0), 2), 0) as points_per_day
            from players
        ), selected as (
            select * from ranked where position <= @limit or user_id = @currentUserId
        )
        select overview.*, selected.rank, selected.user_id, selected.display_name, selected.avatar_url,
            selected.show_supporter_badge, selected.total_points, selected.days_played, selected.points_per_day,
            selected.position <= @limit as in_top_list
        from overview left join selected on true
        order by selected.position;
        """;

    public async Task<EpisodeLadderLeaderboardResponse> GetAsync(Guid? currentUserId, int limit, CancellationToken cancellationToken)
    {
        await using var command = dataSource.CreateCommand(Query);
        command.Parameters.AddWithValue("points", NpgsqlDbType.Array | NpgsqlDbType.Integer, EpisodeLadderScoring.ScoreTable());
        command.Parameters.AddWithValue("maxAttempts", EpisodeLadderRules.MaxAttempts);
        command.Parameters.AddWithValue("limit", Math.Clamp(limit, 1, 100));
        command.Parameters.AddWithValue("currentUserId", NpgsqlDbType.Uuid, (object?)currentUserId ?? DBNull.Value);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var overview = new EpisodeLadderLeaderboardOverview(0, 0, 0, 0);
        var rows = new List<EpisodeLadderLeaderboardEntry>();
        EpisodeLadderLeaderboardEntry? currentUser = null;
        while (await reader.ReadAsync(cancellationToken))
        {
            overview = new(reader.GetInt32(0), reader.GetInt64(1), reader.GetInt64(2), reader.GetDecimal(3));
            if (reader.IsDBNull(5)) continue;
            var userId = reader.GetGuid(5);
            var row = new EpisodeLadderLeaderboardEntry(reader.GetInt64(4), userId, reader.GetString(6),
                reader.IsDBNull(7) ? null : reader.GetString(7), reader.GetBoolean(8), reader.GetInt64(9),
                reader.GetInt32(10), reader.GetDecimal(11), userId == currentUserId);
            if (reader.GetBoolean(12)) rows.Add(row);
            if (row.IsCurrentUser) currentUser = row;
        }
        return new(overview, rows, currentUser);
    }
}
