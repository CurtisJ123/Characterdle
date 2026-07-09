using System.Net;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Characterdle.Server.Features.Leaderboard;

public sealed class SupabaseAuthClient(HttpClient httpClient)
{
    public async Task<VerifiedSupabaseUser?> GetUserAsync(
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/auth/v1/user");
        request.Headers.Authorization = new("Bearer", accessToken);

        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
        {
            return null;
        }

        response.EnsureSuccessStatusCode();

        var payload = await response.Content.ReadFromJsonAsync<SupabaseUserPayload>(cancellationToken);

        if (payload is null || !Guid.TryParse(payload.Id, out var userId))
        {
            return null;
        }

        var displayName = ResolveDisplayName(payload);
        var email = !string.IsNullOrWhiteSpace(payload.Email)
            ? payload.Email.Trim()
            : "ERROR";
        var avatarUrl = !string.IsNullOrWhiteSpace(payload.UserMetadata?.AvatarUrl)
            ? payload.UserMetadata.AvatarUrl.Trim()
            : null;

        return new VerifiedSupabaseUser(
            userId,
            displayName,
            email,
            avatarUrl);
    }

    private static string ResolveDisplayName(SupabaseUserPayload payload)
    {
        var candidates = new[]
        {
            payload.UserMetadata?.DisplayName,
            payload.UserMetadata?.FullName,
            payload.UserMetadata?.Name,
            payload.UserMetadata?.PreferredUsername,
            payload.UserMetadata?.UserName,
            payload.UserMetadata?.Nickname,
            ReadEmailLocalPart(payload.Email),
        };

        return candidates.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? "ERROR";
    }

    private static string? ReadEmailLocalPart(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return null;
        }

        var separatorIndex = email.IndexOf('@');
        var localPart = separatorIndex >= 0
            ? email[..separatorIndex]
            : email;

        return string.IsNullOrWhiteSpace(localPart)
            ? null
            : localPart.Trim();
    }

    private sealed record SupabaseUserPayload(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("email")] string? Email,
        [property: JsonPropertyName("user_metadata")] SupabaseUserMetadataPayload? UserMetadata);

    private sealed record SupabaseUserMetadataPayload(
        [property: JsonPropertyName("avatar_url")] string? AvatarUrl,
        [property: JsonPropertyName("display_name")] string? DisplayName,
        [property: JsonPropertyName("full_name")] string? FullName,
        [property: JsonPropertyName("name")] string? Name,
        [property: JsonPropertyName("nickname")] string? Nickname,
        [property: JsonPropertyName("preferred_username")] string? PreferredUsername,
        [property: JsonPropertyName("user_name")] string? UserName);
}
