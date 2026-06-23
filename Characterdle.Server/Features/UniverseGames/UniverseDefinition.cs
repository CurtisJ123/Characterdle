namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseDefinition(
    string Id,
    string DisplayName,
    string ScheduleTimeZoneId,
    string CharacterTableName,
    string GameTableName,
    string? QuoteTableName,
    string? EpisodeTitleTableName,
    IReadOnlyList<UniverseAttributeDefinition> AttributeDefinitions);
