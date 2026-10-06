using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public static class UniverseCharacterEligibility
{
    // Preserve the whole pre-deactivation pool, not an answer-only exception that gives it away.
    public static bool CanGuess(bool isActive, long? inactiveAfterGameId, long? gameId) =>
        isActive || (gameId is > 0 && inactiveAfterGameId.HasValue && gameId <= inactiveAfterGameId);

    internal static NpgsqlCommand ValidateGuesses(UniverseDefinition universe, long gameId, IReadOnlyList<long> guesses)
    {
        var command = new NpgsqlCommand($"""
            select not exists (
              select 1 from unnest(@guesses::bigint[]) as guess(id)
              left join {universe.CharacterTableName} as characters on characters.id = guess.id
              where characters.id is null
                or not (characters.is_active or coalesce(@gameId <= characters.inactive_after_game_id, false))
            );
            """);
        command.Parameters.AddWithValue("gameId", gameId);
        command.Parameters.AddWithValue("guesses", guesses.ToArray());
        return command;
    }
}

public sealed class InactiveCharacterGuessException() : Exception("A guessed character is not available in this game. Reload the game and try again.");
