namespace Characterdle.Server.Features.Profile;

internal static class ProfileResultQueries
{
    internal static string CompletedResults(string universeId)
    {
        const string characterAndQuote = """
            select game_id, mode, status, guess_count, hint_count, completed_at,
                null::int as difficulty, null::int as points
            from public."UniverseCompletedGameResults"
            where universe_id = @universeId and user_id = @userId
                and mode in ('character', 'quote') and status in ('won', 'lost')
            """;

        if (universeId != "got") return characterAndQuote;

        // Ladder's shared history row summarizes a day; stats need each difficulty exactly once.
        return characterAndQuote + """

            union all
            select progress.game_id, 'episode_ladder', progress.status,
                jsonb_array_length(progress.attempts), 0, progress.updated_at,
                progress.difficulty,
                case when progress.status = 'won'
                    then (@points)[(progress.difficulty - 1) * @maxAttempts + jsonb_array_length(progress.attempts)]
                    else 0 end
            from public."GOTEpisodeLadderProgress" progress
            join public."GOTGames" games on games.id = progress.game_id
            where progress.user_id = @userId and games.datetime <= now()
                and progress.status in ('won', 'lost')
                and progress.difficulty between 1 and 5
                and jsonb_array_length(progress.attempts) between 1 and @maxAttempts
            """;
    }
}
