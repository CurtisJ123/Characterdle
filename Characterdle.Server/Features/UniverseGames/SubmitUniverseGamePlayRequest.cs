namespace Characterdle.Server.Features.UniverseGames;

public sealed record SubmitUniverseGamePlayRequest(
    string ParticipantKey,
    int GuessCount,
    int HintCount,
    string Mode,
    string Status);
