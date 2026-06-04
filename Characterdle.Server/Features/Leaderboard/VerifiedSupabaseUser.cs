namespace Characterdle.Server.Features.Leaderboard;

public sealed record VerifiedSupabaseUser(
    Guid UserId,
    string DisplayName,
    string Email,
    string? AvatarUrl);
