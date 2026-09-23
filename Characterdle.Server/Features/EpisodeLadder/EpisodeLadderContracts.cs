using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Features.EpisodeLadder;

public sealed record LadderGameReference(long Id, DateTimeOffset DateTime, int ArchiveIndex);
public sealed record LadderEvent(long Id, string Description, string? PortraitUrl, int SeasonNumber,
    int EpisodeNumber, int EpisodeIndex, int Minute, int Second, string? Storyline,
    int CorrectPosition = 0, int InitialPosition = 0, string? CharacterName = null, string? EpisodeTitle = null);
public sealed record LadderPuzzle(LadderGameReference Game, int Difficulty, IReadOnlyList<LadderEvent> Events);
public sealed record LadderEpisodeResponse(int SeasonNumber, int EpisodeNumber, string? Title);
public sealed record LadderEventResponse(long Id, string Description, string? PortraitUrl, string? CharacterName,
    LadderEpisodeResponse? Episode = null);
public sealed record LadderAttemptResponse(IReadOnlyList<long> Order, IReadOnlyList<string> Feedback);
public sealed record LadderSolutionResponse(long Id, int SeasonNumber, int EpisodeNumber, int Minute, int Second);
public sealed record EpisodeLadderResponse(long GameId, DateTimeOffset DateTime, int Difficulty, int MaxAttempts,
    IReadOnlyList<LadderEventResponse> Events, IReadOnlyList<long> InitialOrder,
    IReadOnlyList<LadderAttemptResponse> Attempts, IReadOnlyList<int> LockedPositions, string Status,
    IReadOnlyList<LadderSolutionResponse>? Solution, IReadOnlyList<string>? Difficulties = null,
    UniverseStreakResponse? Streak = null);
public sealed record SubmitLadderRequest(long[][]? Attempts, Guid? GuestId = null, int Difficulty = 1);
public sealed record RandomLadderResponse(EpisodeLadderResponse Game, string RoundToken);
public sealed record SubmitRandomLadderRequest(string? RoundToken, long[]? Order);

public sealed class LadderValidationException(string message) : Exception(message);
public sealed class LadderConflictException(EpisodeLadderResponse current) : Exception("This game has newer progress in another tab.")
{
    public EpisodeLadderResponse Current { get; } = current;
}

public interface IEpisodeLadderRepository
{
    Task<IReadOnlyList<LadderEvent>> GetEventCatalogAsync(CancellationToken cancellationToken);
    Task<LadderGameReference?> GetGameReferenceAsync(long? gameId, CancellationToken cancellationToken);
    Task<LadderPuzzle?> GetPuzzleAsync(LadderGameReference game, CancellationToken cancellationToken, int difficulty = 1);
    Task<long[][]> GetAttemptsAsync(Guid userId, long gameId, CancellationToken cancellationToken, int difficulty = 1);
    Task<IReadOnlyList<string>> GetDifficultyStatesAsync(Guid userId, long gameId, CancellationToken cancellationToken);
    Task<EpisodeLadderResponse> SubmitAsync(LadderPuzzle puzzle, Guid? userId, Guid? guestId,
        long[][] attempts, bool importGuest, CancellationToken cancellationToken);
}
