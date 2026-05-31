using System.Text.Json;

namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseCharacterRecord(
    long Id,
    string DisplayName,
    IReadOnlyList<string> Aliases,
    string? PortraitUrl,
    IReadOnlyDictionary<string, JsonElement> Attributes);
