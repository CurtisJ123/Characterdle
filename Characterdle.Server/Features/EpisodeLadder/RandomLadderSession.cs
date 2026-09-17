using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;

namespace Characterdle.Server.Features.EpisodeLadder;

// The answer and accepted attempts travel encrypted, bound to the authenticated player.
// Practice rounds never need a database row or an in-process session cache.
public sealed class RandomLadderSession(IDataProtectionProvider protection, TimeProvider clock)
{
    private readonly IDataProtector _protector = protection.CreateProtector("Characterdle.RandomEpisodeLadder.v1");
    public sealed record Round(Guid UserId, DateTimeOffset ExpiresAt, LadderPuzzle Puzzle, long[][] Attempts);

    public RandomLadderResponse Start(LadderPuzzle puzzle, Guid userId) =>
        Respond(new Round(userId, clock.GetUtcNow().AddHours(6), puzzle, []));

    public RandomLadderResponse Submit(string? token, long[]? order, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(token) || token.Length > 65536 || order?.Length != EpisodeLadderRules.EventCount)
            throw new LadderValidationException("Invalid random Episode Ladder submission.");
        Round? round;
        try { round = JsonSerializer.Deserialize<Round>(_protector.Unprotect(token)); }
        catch (Exception exception) when (exception is CryptographicException or JsonException or FormatException)
        {
            throw new LadderValidationException("This practice round is no longer available. Start a new random game.");
        }
        if (round is null || round.UserId != userId || round.ExpiresAt <= clock.GetUtcNow())
            throw new LadderValidationException("This practice round is no longer available. Start a new random game.");

        // Replay also rejects moving locked events or submitting after the fourth attempt/a win.
        return Respond(round with { Attempts = [.. round.Attempts, order] });
    }

    private RandomLadderResponse Respond(Round round) => new(
        EpisodeLadderRules.Replay(round.Puzzle, round.Attempts),
        _protector.Protect(JsonSerializer.Serialize(round)));
}
