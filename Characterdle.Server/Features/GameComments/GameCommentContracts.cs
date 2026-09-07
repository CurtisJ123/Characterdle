namespace Characterdle.Server.Features.GameComments;

public sealed record CreateGameCommentRequest(string? Body);

public sealed record GameCommentResponse(
    Guid Id,
    string DisplayName,
    string? AvatarUrl,
    string Body,
    DateTimeOffset CreatedAt);

public sealed record GameCommentsPageResponse(
    IReadOnlyList<GameCommentResponse> Comments,
    int Page,
    bool HasNextPage);
