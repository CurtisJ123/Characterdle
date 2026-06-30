namespace Characterdle.Server.Features.UniverseGames;

public sealed record CurrentUniverseGameResponse(
    long Id,
    DateTime DateTime,
    string UniverseId,
    string UniverseName,
    UniverseGameModeStatsResponse CharacterStats,
    UniverseGameModeStatsResponse? QuoteStats,
    IReadOnlyList<UniverseAttributeDefinition> AttributeDefinitions,
    UniverseCharacterRecord AnswerCharacter,
    UniverseQuotePromptRecord? QuotePrompt,
    IReadOnlyList<UniverseCharacterRecord> Characters);
