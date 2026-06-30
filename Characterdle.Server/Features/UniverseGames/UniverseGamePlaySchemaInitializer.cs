using Npgsql;

namespace Characterdle.Server.Features.UniverseGames;

public static class UniverseGamePlaySchemaInitializer
{
    public static async Task EnsureSchemaAsync(
        NpgsqlDataSource dataSource,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            create table if not exists public."UniverseGamePlays" (
              universe_id text not null,
              game_id bigint not null,
              mode text not null,
              participant_key text not null,
              status text null,
              guess_count integer not null default 0,
              hint_count integer not null default 0,
              started_at timestamptz not null default timezone('utc', now()),
              completed_at timestamptz null,
              updated_at timestamptz not null default timezone('utc', now()),
              constraint "PK_UniverseGamePlays" primary key (universe_id, game_id, mode, participant_key),
              constraint "CK_UniverseGamePlays_Mode" check (mode in ('character', 'quote')),
              constraint "CK_UniverseGamePlays_Status" check (status is null or status in ('playing', 'won', 'lost')),
              constraint "CK_UniverseGamePlays_GuessCount" check (guess_count >= 0),
              constraint "CK_UniverseGamePlays_HintCount" check (hint_count >= 0)
            );

            create index if not exists "IX_UniverseGamePlays_UniverseGameMode"
              on public."UniverseGamePlays" (universe_id, game_id, mode);
            """;

        await using var command = dataSource.CreateCommand(sql);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
