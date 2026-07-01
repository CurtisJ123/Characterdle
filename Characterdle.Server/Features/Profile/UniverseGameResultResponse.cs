namespace Characterdle.Server.Features.Profile;

public sealed record UniverseGameResultResponse(
    long GameId,
    string Mode,
    string Status,
    int GuessCount,
    int HintCount,
    IReadOnlyList<long> GuessedCharacterIds,
    IReadOnlyList<string> RevealedHintKeys,
    DateTimeOffset? CompletedAt,
    DateTimeOffset UpdatedAt);
