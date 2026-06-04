namespace Characterdle.Server.Configuration;

public sealed class SchedulingOptions
{
    public const string SectionName = "Scheduling";

    public bool EnableHostedService { get; set; }
}
