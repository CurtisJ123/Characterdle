namespace Characterdle.Server.Features.UniverseGames;

public sealed record DeletedCharacterRecord(
    long Id,
    string DisplayName,
    string? PortraitUrl);

public sealed record UniverseCharacterCleanupResult(
    IReadOnlyList<DeletedCharacterRecord> DeletedCharacters,
    int DeletedQuoteCount,
    int ReassignedGameCount);
