using System.Net.Http.Headers;
using Characterdle.Server.Configuration;
using Microsoft.Extensions.Options;

namespace Characterdle.Server.Features.Admin;

public interface IAdminPortraitStorage
{
    Task<string> UploadAsync(string objectName, ValidatedAdminPortrait portrait, CancellationToken ct);
    Task DeleteAsync(string objectName, CancellationToken ct);
}

public sealed class SupabaseAdminPortraitStorage(HttpClient client, IOptions<SupabaseOptions> options) : IAdminPortraitStorage
{
    public const string Bucket = "character-portraits";

    public async Task<string> UploadAsync(string objectName, ValidatedAdminPortrait portrait, CancellationToken ct)
    {
        using var request = Request(HttpMethod.Post, objectName);
        request.Headers.Add("x-upsert", "false");
        request.Content = new ByteArrayContent(portrait.Data);
        request.Content.Headers.ContentType = new MediaTypeHeaderValue(portrait.Type.MediaType);
        await SendAsync(request, ct);
        return new Uri(client.BaseAddress!, $"/storage/v1/object/public/{Bucket}/{objectName}").AbsoluteUri;
    }

    public async Task DeleteAsync(string objectName, CancellationToken ct)
    {
        using var request = Request(HttpMethod.Delete, objectName);
        request.RequestUri = new Uri($"/storage/v1/object/{Bucket}", UriKind.Relative);
        request.Content = JsonContent.Create(new { prefixes = new[] { objectName } });
        await SendAsync(request, ct);
    }

    private HttpRequestMessage Request(HttpMethod method, string objectName)
    {
        if (objectName.Any(c => !char.IsAsciiLetterOrDigit(c) && c != '.'))
            throw new InvalidOperationException("Invalid portrait object name.");
        var key = options.Value.ServiceRoleKey;
        if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Portrait storage is not configured.");
        var request = new HttpRequestMessage(method, $"/storage/v1/object/{Bucket}/{objectName}");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
        request.Headers.Add("apikey", key);
        return request;
    }

    private async Task SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        try
        {
            using var response = await client.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException("Portrait storage rejected the request.", null, response.StatusCode);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        { throw new HttpRequestException("Portrait storage timed out."); }
    }
}
