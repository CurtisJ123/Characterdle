using System.Text.Json.Serialization;
using Characterdle.Server.Features.Announcements;

namespace Characterdle.Server.Features.Admin;

public sealed record NewAdminCharacter(
    [property: JsonRequired] string DisplayName, [property: JsonRequired] string[] Aliases,
    [property: JsonRequired] string Gender, [property: JsonRequired] string Species,
    [property: JsonRequired] string[] House, [property: JsonRequired] string[] Occupation,
    [property: JsonRequired] int DebutSeason, [property: JsonRequired] int LastSeason,
    [property: JsonRequired] bool Alive, [property: JsonRequired] string? PortraitUrl)
{
    public SaveAdminCharacter AsEdit() => new("0", DisplayName, Aliases, Gender, Species, House,
        Occupation, DebutSeason, LastSeason, Alive, PortraitUrl);
}

public sealed record NewAdminQuote(
    [property: JsonRequired] long CharacterId, [property: JsonRequired] string QuoteText,
    [property: JsonRequired] int SeasonNumber, [property: JsonRequired] int EpisodeNumber,
    [property: JsonRequired] long? EpisodeTitleId)
{
    public SaveAdminQuote AsEdit() => new("0", CharacterId, QuoteText, SeasonNumber, EpisodeNumber, EpisodeTitleId);
}

public sealed record AdminPortraitUpload([property: JsonRequired] string ContentType, [property: JsonRequired] string Data);
public sealed record CreateAdminCharacter([property: JsonRequired] Guid RequestId,
    [property: JsonRequired] NewAdminCharacter Character, AdminPortraitUpload? Portrait);
public sealed record CreateAdminQuote([property: JsonRequired] Guid RequestId, [property: JsonRequired] NewAdminQuote Quote);
public sealed record ValidatedAdminPortrait(byte[] Data, AnnouncementImageType Type);

public interface IAdminCatalogCreator
{
    Task<AdminCharacter> CreateCharacterAsync(CreateAdminCharacter request, ValidatedAdminPortrait? portrait, CancellationToken ct);
    Task<AdminQuote> CreateQuoteAsync(CreateAdminQuote request, CancellationToken ct);
}

public sealed class AdminCatalogConflictException(string message) : Exception(message);
