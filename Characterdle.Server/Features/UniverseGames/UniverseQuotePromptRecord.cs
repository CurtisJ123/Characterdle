namespace Characterdle.Server.Features.UniverseGames;

public sealed record UniverseQuotePromptRecord(
    long Id,
    long CharacterId,
    string Text,
    int SeasonNumber,
    int EpisodeNumber,
    string? EpisodeTitle);
