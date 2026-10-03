using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Leaderboard;

public interface ILeaderboardViewerResolver
{
    Task<Guid?> ResolveAsync(Guid? authenticatedUserId, string? guestHeader, CancellationToken ct);
}

public sealed class LeaderboardViewerResolver(NpgsqlDataSource dataSource, ILogger<LeaderboardViewerResolver> logger)
    : ILeaderboardViewerResolver
{
    public async Task<Guid?> ResolveAsync(Guid? authenticatedUserId, string? guestHeader, CancellationToken ct)
    {
        if (authenticatedUserId.HasValue) return authenticatedUserId;
        if (!LeaderboardVisibility.TryGuestId(guestHeader, out var guestId)) return null;
        try
        {
            await using var command = dataSource.CreateCommand("""
                select m.user_id from public."PlayerModerationGuestLinks" l
                join public."PlayerModeration" m on m.user_id=l.user_id
                where l.guest_id=@guest and l.unlinked_at is null and m.state='shadow_banned'
                  and (m.expires_at is null or m.expires_at>now())
                """);
            command.Parameters.AddWithValue("guest", guestId);
            return await command.ExecuteScalarAsync(ct) is Guid id ? id : null;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // This fallback only removes the guest exception. Eligibility still fails closed.
            logger.LogWarning(ex, "Guest leaderboard association unavailable; using the public view.");
            return null;
        }
    }
}

internal static class LeaderboardVisibility
{
    internal const string GuestHeader = "X-Leaderboard-Guest-Id";

    internal static bool TryGuestId(string? value, out Guid id)
    {
        var normalized = value?.Trim();
        if (normalized?.StartsWith("guest:", StringComparison.OrdinalIgnoreCase) == true) normalized = normalized[6..];
        return Guid.TryParseExact(normalized, "D", out id) && id != Guid.Empty;
    }

    internal static void Headers(HttpContext context)
    {
        context.Response.Headers.CacheControl = "private, no-store";
        context.Response.Headers.Vary = $"Authorization, {GuestHeader}";
    }

    internal static async Task<Guid[]> RestrictedAsync(NpgsqlDataSource source, CancellationToken ct)
    {
        await using var command = source.CreateCommand("""
            select user_id from public."PlayerModeration"
            where state='shadow_banned' and (expires_at is null or expires_at>now())
            """);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var ids = new List<Guid>();
        while (await reader.ReadAsync(ct)) ids.Add(reader.GetGuid(0));
        return ids.ToArray();
    }

    internal static void Parameters(NpgsqlCommand command, Guid[] restricted, Guid? viewer)
    {
        command.Parameters.AddWithValue("restrictedUsers", NpgsqlDbType.Array | NpgsqlDbType.Uuid, restricted);
        command.Parameters.AddWithValue("visibilityUserId", NpgsqlDbType.Uuid, (object?)viewer ?? DBNull.Value);
    }
}
