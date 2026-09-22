namespace Characterdle.Server.Features.Leaderboard;

public sealed class GameReplayNotAvailableException : Exception
{
    public GameReplayNotAvailableException()
        : base("This game is not yet eligible for replay. Reload the game to refresh your progress.") { }
}
