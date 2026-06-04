namespace Characterdle.Server.Features.Leaderboard;

public sealed record SubmitUniverseGameResultRequest(
    long GameId,
    int GuessCount,
    int HintCount,
    string Mode,
    string Status);
