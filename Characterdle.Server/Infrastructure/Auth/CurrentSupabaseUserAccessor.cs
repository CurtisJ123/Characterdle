using Characterdle.Server.Features.Leaderboard;

namespace Characterdle.Server.Infrastructure.Auth;

public sealed class CurrentSupabaseUserAccessor(
    IHttpContextAccessor httpContextAccessor,
    SupabaseAuthClient authClient) : ICurrentSupabaseUserAccessor
{
    private static readonly object UserCacheKey = new();
    private static readonly object UserLookupCompleteKey = new();

    public async Task<VerifiedSupabaseUser?> GetCurrentUserAsync(CancellationToken cancellationToken)
    {
        var httpContext = httpContextAccessor.HttpContext;

        if (httpContext is null)
        {
            return null;
        }

        if (httpContext.Items.TryGetValue(UserCacheKey, out var cachedUser))
        {
            return cachedUser as VerifiedSupabaseUser;
        }

        if (httpContext.Items.ContainsKey(UserLookupCompleteKey))
        {
            return null;
        }

        httpContext.Items[UserLookupCompleteKey] = true;

        var accessToken = ReadBearerToken(httpContext.Request);

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            return null;
        }

        var user = await authClient.GetUserAsync(accessToken, cancellationToken);

        if (user is not null)
        {
            httpContext.Items[UserCacheKey] = user;
        }

        return user;
    }

    private static string? ReadBearerToken(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Authorization", out var authorizationHeaderValues))
        {
            return null;
        }

        var authorizationHeader = authorizationHeaderValues.ToString();

        if (!authorizationHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return authorizationHeader["Bearer ".Length..].Trim();
    }
}
