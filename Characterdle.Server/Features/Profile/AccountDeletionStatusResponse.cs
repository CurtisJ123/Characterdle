namespace Characterdle.Server.Features.Profile;

public sealed record AccountDeletionStatusResponse(
    bool CanDelete,
    bool HasActiveSubscription,
    string Message);
