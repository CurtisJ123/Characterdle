using System.Security.Cryptography;
using System.Text;

namespace Characterdle.Server.Features.EpisodeLadder;

public static class EpisodeLadderRules
{
    public const int EventCount = 5;
    public const int MaxAttempts = 4;

    public static EpisodeLadderResponse Replay(LadderPuzzle puzzle, IReadOnlyList<long[]> attempts)
    {
        if (attempts.Count > MaxAttempts)
            throw new LadderValidationException("You have four attempts to complete the ladder.");

        var answer = puzzle.Events.OrderBy(e => e.CorrectPosition).Select(e => e.Id).ToArray();
        if (answer.Length != EventCount || answer.Distinct().Count() != EventCount)
            throw new InvalidOperationException("The ladder puzzle is incomplete.");
        var locked = new HashSet<int>();
        var feedback = new List<LadderAttemptResponse>();
        var status = "playing";

        foreach (var order in attempts)
        {
            if (status != "playing")
                throw new LadderValidationException("This ladder is already complete.");
            if (order is null || order.Length != EventCount || order.Distinct().Count() != EventCount
                || order.Any(id => !answer.Contains(id)))
                throw new LadderValidationException("Submit each of this game's five events exactly once.");
            if (locked.Any(position => order[position] != answer[position]))
                throw new LadderValidationException("Correct events are locked and cannot be moved.");

            var tones = order.Select((id, position) =>
            {
                var distance = Math.Abs(Array.IndexOf(answer, id) - position);
                if (distance == 0) locked.Add(position);
                return distance == 0 ? "correct" : distance == 1 ? "adjacent" : "incorrect";
            }).ToArray();
            feedback.Add(new LadderAttemptResponse(order, tones));
            status = locked.Count == EventCount ? "won" : feedback.Count == MaxAttempts ? "lost" : "playing";
        }

        var startingEvents = puzzle.Events.OrderBy(e => e.InitialPosition).ToArray();
        return new EpisodeLadderResponse(puzzle.Game.Id, puzzle.Game.DateTime, puzzle.Difficulty, MaxAttempts,
            // Episode metadata is earned per correct position, never sent for an unsolved card.
            startingEvents.Select(e => new LadderEventResponse(e.Id, e.Description, e.PortraitUrl, e.CharacterName,
                locked.Contains(e.CorrectPosition - 1)
                    ? new LadderEpisodeResponse(e.SeasonNumber, e.EpisodeNumber, e.EpisodeTitle) : null)).ToArray(),
            startingEvents.Select(e => e.Id).ToArray(), feedback, locked.Order().ToArray(), status,
            status == "playing" ? null : puzzle.Events.OrderBy(e => e.CorrectPosition)
                .Select(e => new LadderSolutionResponse(e.Id, e.SeasonNumber, e.EpisodeNumber, e.Minute, e.Second)).ToArray());
    }

    public static bool IsPrefix(IReadOnlyList<long[]> prefix, IReadOnlyList<long[]> attempts) =>
        prefix.Count <= attempts.Count && prefix.Select((order, index) => order.SequenceEqual(attempts[index])).All(matches => matches);

    public static LadderPuzzle? Generate(LadderGameReference game, IReadOnlyList<LadderEvent> catalog, int difficulty = 1)
    {
        var seed = SHA256.HashData(Encoding.UTF8.GetBytes($"got:episode-ladder:v3:{game.Id}:{difficulty}"));
        var random = new Random(System.Buffers.Binary.BinaryPrimitives.ReadInt32LittleEndian(seed));
        return Generate(game, catalog, random, difficulty);
    }

    public static LadderPuzzle? GenerateRandom(IReadOnlyList<LadderEvent> catalog, int difficulty = 1) =>
        Generate(new LadderGameReference(0, DateTimeOffset.UtcNow, 0), catalog, Random.Shared, difficulty);

    private static LadderPuzzle? Generate(LadderGameReference game, IReadOnlyList<LadderEvent> catalog, Random random, int difficulty)
    {
        if (difficulty is < 1 or > 5) throw new LadderValidationException("Choose a difficulty from 1 to 5.");
        if (catalog.Count < EventCount) return null;
        var totalGaps = new[] { 15, 10, 6, 4, 0 }[difficulty - 1];
        var span = totalGaps + EventCount - 1;
        var episodes = catalog.GroupBy(e => e.EpisodeIndex)
            .ToDictionary(group => group.Key, group => group.OrderBy(e => e.Id).ToArray());
        var anchors = episodes.Keys.Order().ToArray();
        random.Shuffle(anchors);

        foreach (var anchor in anchors)
        {
            var lastEpisode = anchor + span;
            if (!episodes.ContainsKey(lastEpisode)) continue;
            var middleEpisodes = episodes.Keys.Where(index => index > anchor && index < lastEpisode).Order().ToArray();
            if (middleEpisodes.Length < EventCount - 2) continue;

            // Fixing both endpoints makes the four skipped-episode gaps sum exactly to the budget.
            // Random interior episodes allow uneven spacing, including consecutive episode pairs.
            random.Shuffle(middleEpisodes);
            var selectedEpisodes = new[] { anchor }.Concat(middleEpisodes.Take(EventCount - 2)).Append(lastEpisode).Order();
            var selected = new List<LadderEvent>();
            foreach (var episode in selectedEpisodes)
            {
                var pool = episodes[episode];
                var newStorylines = pool.Where(e => !selected.Any(s => s.Storyline == e.Storyline)).ToArray();
                if (newStorylines.Length > 0) pool = newStorylines;
                selected.Add(pool[random.Next(pool.Length)]);
            }

            var answer = selected.ToArray();
            var shuffled = answer.Select(e => e.Id).ToArray();
            random.Shuffle(shuffled);
            if (shuffled.SequenceEqual(answer.Select(e => e.Id)))
                (shuffled[0], shuffled[1]) = (shuffled[1], shuffled[0]);
            return new LadderPuzzle(game, difficulty, answer.Select((e, index) => e with
            {
                CorrectPosition = index + 1,
                InitialPosition = Array.IndexOf(shuffled, e.Id) + 1,
            }).ToArray());
        }
        return null;
    }
}
