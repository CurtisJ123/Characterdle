using Npgsql;

namespace Characterdle.Server.Infrastructure.Database;

public sealed class DatabaseMigrator(
    NpgsqlDataSource dataSource,
    IEnumerable<IDatabaseMigration> migrations,
    ILogger<DatabaseMigrator> logger)
{
    public async Task ApplyPendingMigrationsAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = await dataSource.OpenConnectionAsync(cancellationToken);
        await AcquireMigrationLockAsync(connection, cancellationToken);
        await EnsureHistoryTableAsync(connection, cancellationToken);

        var appliedMigrationIds = await LoadAppliedMigrationIdsAsync(connection, cancellationToken);
        var orderedMigrations = migrations
            .OrderBy(migration => migration.Id, StringComparer.Ordinal)
            .ToArray();

        foreach (var migration in orderedMigrations)
        {
            if (appliedMigrationIds.Contains(migration.Id))
            {
                continue;
            }

            logger.LogInformation("Applying database migration {MigrationId}: {Description}", migration.Id, migration.Description);

            await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

            try
            {
                await using (var migrationCommand = new NpgsqlCommand(migration.Sql, connection, transaction))
                {
                    await migrationCommand.ExecuteNonQueryAsync(cancellationToken);
                }

                await using (var historyCommand = new NpgsqlCommand(
                    """
                    insert into public."SchemaMigrations" (
                      id,
                      description
                    )
                    values (
                      @id,
                      @description
                    );
                    """,
                    connection,
                    transaction))
                {
                    historyCommand.Parameters.AddWithValue("id", migration.Id);
                    historyCommand.Parameters.AddWithValue("description", migration.Description);
                    await historyCommand.ExecuteNonQueryAsync(cancellationToken);
                }

                await transaction.CommitAsync(cancellationToken);
                logger.LogInformation("Applied database migration {MigrationId}.", migration.Id);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }
    }

    private static async Task AcquireMigrationLockAsync(
        NpgsqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            "select pg_advisory_lock(1486116304);",
            connection);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task EnsureHistoryTableAsync(
        NpgsqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            """
            create table if not exists public."SchemaMigrations" (
              id text primary key,
              description text not null,
              applied_at timestamptz not null default timezone('utc', now())
            );
            """,
            connection);

        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    private static async Task<HashSet<string>> LoadAppliedMigrationIdsAsync(
        NpgsqlConnection connection,
        CancellationToken cancellationToken)
    {
        await using var command = new NpgsqlCommand(
            """
            select id
            from public."SchemaMigrations";
            """,
            connection);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var appliedMigrationIds = new HashSet<string>(StringComparer.Ordinal);

        while (await reader.ReadAsync(cancellationToken))
        {
            appliedMigrationIds.Add(reader.GetString(0));
        }

        return appliedMigrationIds;
    }
}
