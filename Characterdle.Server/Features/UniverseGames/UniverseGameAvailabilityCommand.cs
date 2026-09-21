using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public static class UniverseGameAvailabilityCommand
{
    public static NpgsqlCommand Create(UniverseDefinition universe, long gameId, string mode)
    {
        if (mode is not "character" and not "quote") throw new ArgumentException("Invalid game mode.", nameof(mode));
        // Identifiers come only from the server-owned UniverseCatalog, never request data.
        var quoteCheck = mode != "quote" ? string.Empty
            : string.IsNullOrWhiteSpace(universe.QuoteTableName) ? "and false"
            : $"""
              and exists (
                select 1 from {universe.QuoteTableName} as quotes
                join {universe.CharacterTableName} as speakers on speakers.id = quotes.character_id
                where quotes.id = games.quote_id
              )
              """;
        var command = new NpgsqlCommand($"""
            select exists (
              select 1 from {universe.GameTableName} as games
              join {universe.CharacterTableName} as characters on characters.id = games.character_id
              where games.id = @gameId and games.datetime <= now()
              {quoteCheck}
            );
            """);
        command.Parameters.AddWithValue("gameId", gameId);
        return command;
    }
}
