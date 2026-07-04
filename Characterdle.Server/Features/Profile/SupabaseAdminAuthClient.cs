using System.Net;
using Characterdle.Server.Configuration;
using Microsoft.Extensions.Options;

namespace Characterdle.Server.Features.Profile;

public sealed class SupabaseAdminAuthClient(
    HttpClient httpClient,
    IOptions<SupabaseOptions> options)
{
    private readonly SupabaseOptions supabaseOptions = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(supabaseOptions.ServiceRoleKey);

    public async Task DeleteUserAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Supabase service role key is not configured for account deletion.");
        }

        using var request = new HttpRequestMessage(HttpMethod.Delete, $"/auth/v1/admin/users/{userId}");
        request.Headers.Authorization = new("Bearer", supabaseOptions.ServiceRoleKey);

        using var response = await httpClient.SendAsync(request, cancellationToken);

        if (response.StatusCode == HttpStatusCode.NotFound)
        {
            return;
        }

        response.EnsureSuccessStatusCode();
    }
}
