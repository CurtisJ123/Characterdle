namespace Characterdle.Server.Features.Profile;

public sealed record ProfileRecentResultResponse(
    long GameId,
    string Mode,
    string Status,
    int GuessCount,
    int HintCount,
    DateTimeOffset CompletedAt,
    int? Difficulty = null,
    int? Points = null);
