using Characterdle.Server.Features.UniverseGames;
using Npgsql;

namespace Characterdle.Server.Features.GameComments;

public sealed class GameCommentRepository(NpgsqlDataSource dataSource) : IGameCommentRepository
{
    private const int PageSize = 5;

    public async Task<GameCommentsPageResponse?> GetPageAsync(
        Guid userId, UniverseDefinition universe, long gameId, string mode, int page,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            with authorized as ({CompletedGameSql(universe, mode)})
            select comments.id, profiles.display_name, profiles.avatar_url,
              coalesce(premium_status.is_premium, false), comments.body, comments.created_at
            from authorized
            left join lateral (
              select id, user_id, body, created_at
              from public."UniverseGameComments"
              where universe_id = @universeId and game_id = @gameId and mode = @mode
              order by created_at asc, id asc
              offset @offset limit @limit
            ) as comments on true
            left join public."PlayerProfiles" as profiles on profiles.user_id = comments.user_id
            left join public."UserPremiumStatus" as premium_status on premium_status.user_id = comments.user_id
            order by comments.created_at asc, comments.id asc;
            """;

        await using var command = CreateCommand(sql, userId, universe, gameId, mode);
        command.Parameters.AddWithValue("offset", ((long)page - 1) * PageSize);
        command.Parameters.AddWithValue("limit", PageSize + 1);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        // An authorized empty page has one null row; an unauthorized request has no rows.
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var comments = new List<GameCommentResponse>();
        do
        {
            if (!reader.IsDBNull(0))
            {
                comments.Add(ReadComment(reader));
            }
        } while (await reader.ReadAsync(cancellationToken));

        return new GameCommentsPageResponse(comments.Take(PageSize).ToArray(), page, comments.Count > PageSize);
    }

    public async Task<GameCommentResponse?> CreateAsync(
        Guid userId, UniverseDefinition universe, long gameId, string mode, string body,
        CancellationToken cancellationToken)
    {
        var sql = $"""
            with authorized as ({CompletedGameSql(universe, mode)}),
            inserted as (
              insert into public."UniverseGameComments" (user_id, universe_id, game_id, mode, body)
              select @userId, @universeId, @gameId, @mode, @body
              from authorized
              returning id, user_id, body, created_at
            )
            select inserted.id, profiles.display_name, profiles.avatar_url,
              coalesce(premium_status.is_premium, false), inserted.body, inserted.created_at
            from inserted
            join public."PlayerProfiles" as profiles on profiles.user_id = inserted.user_id
            left join public."UserPremiumStatus" as premium_status on premium_status.user_id = inserted.user_id;
            """;

        await using var command = CreateCommand(sql, userId, universe, gameId, mode);
        command.Parameters.AddWithValue("body", body);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        return await reader.ReadAsync(cancellationToken) ? ReadComment(reader) : null;
    }

    internal static string CompletedGameSql(UniverseDefinition universe, string mode)
    {
        // Identifiers come exclusively from the server's universe catalog. Request values are parameters.
        if (mode == "episode_ladder")
        {
            // Ladder has one discussion per day, unlocked by all five saved results, including losses.
            // Unlike Character/Quote, completed Ladder difficulties never expire or become replayable.
            return """
                select 1
                from public."GOTGames" as games
                join public."PlayerProfiles" as player on player.user_id = @userId
                where @universeId = 'got'
                  and games.id = @gameId
                  and games.datetime <= now()
                  and (
                    select count(distinct progress.difficulty)
                    from public."GOTEpisodeLadderProgress" as progress
                    where progress.user_id = @userId
                      and progress.game_id = games.id
                      and progress.difficulty between 1 and 5
                      and progress.status in ('won', 'lost')
                  ) = 5
                """;
        }

        var quoteCondition = mode == "quote" ? "and games.quote_id is not null" : string.Empty;
        return $"""
            select 1
            from public."UniverseGameResults" as results
            join {universe.GameTableName} as games on games.id = results.game_id
            join public."PlayerProfiles" as player on player.user_id = results.user_id
            where results.user_id = @userId
              and results.universe_id = @universeId
              and results.game_id = @gameId
              and results.mode = @mode
              and results.completed_at is not null
              and (
                results.status = 'won'
                or (results.status = 'lost' and results.completed_at > now() - interval '30 days')
              )
              and games.datetime <= now()
              {quoteCondition}
            """;
    }

    private NpgsqlCommand CreateCommand(string sql, Guid userId, UniverseDefinition universe, long gameId, string mode)
    {
        var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("universeId", universe.Id);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("mode", mode);
        return command;
    }

    private static GameCommentResponse ReadComment(NpgsqlDataReader reader) => new(
        reader.GetGuid(0),
        reader.GetString(1),
        reader.IsDBNull(2) ? null : SafeAvatarUrl(reader.GetString(2)),
        reader.GetBoolean(3),
        reader.GetString(4),
        reader.GetFieldValue<DateTimeOffset>(5));

    private static string? SafeAvatarUrl(string value)
    {
        if (value.StartsWith("/images/", StringComparison.Ordinal) && !value.Contains('\\'))
        {
            return value;
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps
            ? value
            : null;
    }
}
