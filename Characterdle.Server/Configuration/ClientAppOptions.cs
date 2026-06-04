namespace Characterdle.Server.Configuration;

public sealed class ClientAppOptions
{
    public const string SectionName = "ClientApp";

    public string ApiBaseUrl { get; set; } = string.Empty;

    public string[] AllowedOrigins { get; set; } = [];
}
