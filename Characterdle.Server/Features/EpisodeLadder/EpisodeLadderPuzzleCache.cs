using Microsoft.Extensions.Caching.Memory;

namespace Characterdle.Server.Features.EpisodeLadder;

// Shared definitions only: never cache player attempts, access decisions, or API responses.
public sealed class EpisodeLadderPuzzleCache(TimeProvider timeProvider) : IDisposable
{
    internal static readonly TimeSpan Lifetime = TimeSpan.FromMinutes(1);
    private readonly MemoryCache _cache = new(new MemoryCacheOptions { SizeLimit = 128 });
    private sealed record Entry(DateTimeOffset ExpiresAt, IReadOnlyList<LadderPuzzle> Puzzles);

    public LadderPuzzle? Get(LadderGameReference game, int difficulty)
    {
        if (!_cache.TryGetValue(game.Id, out Entry? entry) || entry is null) return null;
        if (timeProvider.GetUtcNow() >= entry.ExpiresAt)
        {
            _cache.Remove(game.Id);
            return null;
        }
        // Archive age must come from today's lookup, not the cached game reference.
        return entry.Puzzles.Single(puzzle => puzzle.Difficulty == difficulty) with { Game = game };
    }

    public void Set(IReadOnlyList<LadderPuzzle> puzzles)
    {
        if (puzzles.Count != 5 || !puzzles.Select(p => p.Difficulty).Order().SequenceEqual(new[] { 1, 2, 3, 4, 5 })
            || puzzles.Any(p => p.Events.Count != 5 || p.Game.Id <= 0 || p.Game.Id != puzzles[0].Game.Id))
            return;
        var snapshot = puzzles.Select(p => p with { Events = Array.AsReadOnly(p.Events.ToArray()) }).ToArray();
        _cache.Set(puzzles[0].Game.Id, new Entry(timeProvider.GetUtcNow() + Lifetime, snapshot),
            new MemoryCacheEntryOptions { Size = 1, AbsoluteExpirationRelativeToNow = Lifetime });
    }

    public void Dispose() => _cache.Dispose();
}
