using System.Text.Json.Serialization;

namespace Characterdle.Server.Features.Admin;

public sealed record AdminCharacter(long Id, string Version, string DisplayName, string[] Aliases,
    string Gender, string Species, string[] House, string[] Occupation, int DebutSeason, int LastSeason,
    bool Alive, string? PortraitUrl);
public sealed record AdminQuote(long Id, string Version, long CharacterId, string QuoteText,
    int SeasonNumber, int EpisodeNumber, long? EpisodeTitleId);
public sealed record AdminEpisode(long Id, int SeasonNumber, int EpisodeNumber, string Title);
public sealed record AdminCharacterOption(long Id, string DisplayName);
public sealed record AdminCatalogOptions(IReadOnlyList<AdminCharacterOption> Characters, IReadOnlyList<AdminEpisode> Episodes);
public sealed record SaveAdminCharacter(
    [property: JsonRequired] string ExpectedVersion, [property: JsonRequired] string DisplayName,
    [property: JsonRequired] string[] Aliases, [property: JsonRequired] string Gender,
    [property: JsonRequired] string Species, [property: JsonRequired] string[] House,
    [property: JsonRequired] string[] Occupation, [property: JsonRequired] int DebutSeason,
    [property: JsonRequired] int LastSeason, [property: JsonRequired] bool Alive, [property: JsonRequired] string? PortraitUrl);
public sealed record SaveAdminQuote(
    [property: JsonRequired] string ExpectedVersion, [property: JsonRequired] long CharacterId,
    [property: JsonRequired] string QuoteText, [property: JsonRequired] int SeasonNumber,
    [property: JsonRequired] int EpisodeNumber, [property: JsonRequired] long? EpisodeTitleId);

public interface IAdminCatalogRepository
{
    Task<IReadOnlyList<AdminCharacter>> CharactersAsync(CancellationToken ct);
    Task<IReadOnlyList<AdminQuote>> QuotesAsync(CancellationToken ct);
    Task<AdminCatalogOptions> OptionsAsync(CancellationToken ct);
    Task<AdminCharacter?> UpdateCharacterAsync(long id, SaveAdminCharacter request, CancellationToken ct);
    Task<AdminQuote?> UpdateQuoteAsync(long id, SaveAdminQuote request, CancellationToken ct);
}

public sealed class AdminCatalogValidationException(string message) : Exception(message);

public static class AdminCatalogValidation
{
    public static bool ValidId(long id) => id is > 0 and <= 9007199254740991;
    private static bool Version(string? value) => value is { Length: > 0 and <= 10 }
        && value.All(char.IsAsciiDigit) && uint.TryParse(value, out _);
    private static bool Text(string? value, int max, bool multiline = false) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= max
        && !value.Any(c => char.IsControl(c) && !(multiline && c is '\r' or '\n' or '\t'));
    private static bool Values(string[]? values) => values is { Length: <= 50 } && values.All(v => Text(v, 200));

    public static string? Validate(SaveAdminCharacter r)
    {
        if (!Version(r.ExpectedVersion)) return "Reload the row before saving.";
        if (!Text(r.DisplayName, 200)) return "Name must contain 1 to 200 characters.";
        if (!Values(r.Aliases) || !Values(r.House) || !Values(r.Occupation)) return "Use at most 50 non-empty values per list, up to 200 characters each.";
        if (!Text(r.Gender, 100) || !Text(r.Species, 100)) return "Gender and species must contain 1 to 100 characters.";
        if (r.DebutSeason is < 0 or > 8 || r.LastSeason is < 0 or > 8 || r.LastSeason < r.DebutSeason)
            return "Seasons must be between 0 and 8, with last season at or after debut.";
        if (r.PortraitUrl is not null && (!Text(r.PortraitUrl, 2048) || r.PortraitUrl.Any(char.IsWhiteSpace)
            || r.PortraitUrl.Contains('\\') || !(r.PortraitUrl.StartsWith("/images/", StringComparison.Ordinal)
                || (Uri.TryCreate(r.PortraitUrl, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)))))
            return "Portrait URL must be an HTTPS URL or a local /images/ path, up to 2,048 characters.";
        return null;
    }

    public static string? Validate(SaveAdminQuote r)
    {
        if (!Version(r.ExpectedVersion)) return "Reload the row before saving.";
        if (!ValidId(r.CharacterId) || (r.EpisodeTitleId is { } id && !ValidId(id))) return "Choose a valid character and episode.";
        if (!Text(r.QuoteText, 10000, true)) return "Quote must contain 1 to 10,000 characters without invalid control characters.";
        var episodes = r.SeasonNumber switch { >= 1 and <= 6 => 10, 7 => 7, 8 => 6, _ => 0 };
        if (r.EpisodeNumber < 1 || r.EpisodeNumber > episodes) return "Choose a valid Game of Thrones season and episode.";
        return null;
    }
}
