namespace Characterdle.Server.Configuration;

public sealed class SupabaseOptions
{
    public const string SectionName = "Supabase";

    public string PublishableKey { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;
}
