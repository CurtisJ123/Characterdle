namespace Characterdle.Server.Features.Profile;

public sealed record AccountDeletionEligibility(
    bool CanDelete,
    bool HasActiveSubscription,
    string? Message);
