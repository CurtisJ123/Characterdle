namespace Characterdle.Server.Infrastructure.Database;

public interface IDatabaseMigration
{
    string Description { get; }

    string Id { get; }

    string Sql { get; }
}
