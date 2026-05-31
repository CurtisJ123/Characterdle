namespace Characterdle.Server.Features.UniverseGames;

public sealed record PreviousUniverseGamesResponse(
    string UniverseId,
    string UniverseName,
    IReadOnlyList<UniverseAttributeDefinition> AttributeDefinitions,
    IReadOnlyList<PreviousUniverseGameRecord> Games);
