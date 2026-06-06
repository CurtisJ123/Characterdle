namespace Characterdle.Server.Features.Profile;

public sealed record UserUniverseProfileResponse(
    string UniverseId,
    string UniverseName,
    Guid UserId,
    string DisplayName,
    string Email,
    string? AvatarUrl,
    DateTimeOffset MemberSince,
    int TotalWins,
    int TotalPlays,
    int TotalLosses,
    double TotalCompletionRate,
    double? AverageGuesses,
    int? OverallRank,
    ProfileModeStatsResponse Character,
    ProfileModeStatsResponse Quote,
    IReadOnlyList<ProfileRecentResultResponse> RecentResults);
