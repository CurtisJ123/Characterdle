namespace Characterdle.Server.Configuration;

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    public bool RunMigrationsOnStartup { get; set; } = true;
}
