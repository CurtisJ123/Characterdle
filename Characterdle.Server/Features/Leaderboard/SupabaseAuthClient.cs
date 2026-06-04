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

        var displayName = !string.IsNullOrWhiteSpace(payload.UserMetadata?.DisplayName)
            ? payload.UserMetadata.DisplayName.Trim()
            : "ERROR";
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

    private sealed record SupabaseUserPayload(
        [property: JsonPropertyName("id")] string Id,
        [property: JsonPropertyName("email")] string? Email,
        [property: JsonPropertyName("user_metadata")] SupabaseUserMetadataPayload? UserMetadata);

    private sealed record SupabaseUserMetadataPayload(
        [property: JsonPropertyName("avatar_url")] string? AvatarUrl,
        [property: JsonPropertyName("display_name")] string? DisplayName);
}
