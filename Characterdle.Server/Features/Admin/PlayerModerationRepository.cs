using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Characterdle.Server.Features.Leaderboard;
using Npgsql;
using NpgsqlTypes;

namespace Characterdle.Server.Features.Admin;

public sealed class PlayerModerationRepository(NpgsqlDataSource source) : IPlayerModerationRepository
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    internal const string StateQuery = """
        select jsonb_build_object(
          'state',coalesce(m.state,'normal'),
          'isRestricted',coalesce(m.state='shadow_banned' and (m.expires_at is null or m.expires_at>now()),false),
          'reason',coalesce(m.reason,''),'expiresAt',m.expires_at,'updatedAt',m.updated_at,
          'updatedBy',m.updated_by,'revision',coalesce(m.revision,0),
          'guestLinks',coalesce((select jsonb_agg(jsonb_build_object('guestId',l.guest_id,'linkedAt',l.linked_at,'linkedBy',l.linked_by)
             order by l.guest_id) from public."PlayerModerationGuestLinks" l
             where l.user_id=@userId and l.unlinked_at is null),'[]'::jsonb))::text
        from (select 1) seed left join public."PlayerModeration" m on m.user_id=@userId
        """;

    public async Task<PlayerModerationState> GetAsync(Guid userId, CancellationToken ct)
    {
        await using var connection = await source.OpenConnectionAsync(ct);
        return await ReadAsync(connection, null, userId, ct);
    }

    private static async Task<PlayerModerationState> ReadAsync(NpgsqlConnection connection, NpgsqlTransaction? tx, Guid userId, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand(StateQuery, connection, tx);
        command.Parameters.AddWithValue("userId", userId);
        return JsonSerializer.Deserialize<PlayerModerationState>((string)(await command.ExecuteScalarAsync(ct))!, Json)!;
    }

    public async Task<PlayerModerationState> SaveAsync(Guid userId, Guid actorId, SavePlayerModerationRequest request, CancellationToken ct)
    {
        if (PlayerModerationValidation.Validate(request) is { } invalid) throw new PlayerModerationException(400, invalid);
        var guests = request.GuestIds.Select(ParseGuest).Order().ToArray();
        var reassignments = request.Reassignments.Select(r => new { GuestId = ParseGuest(r.GuestId), r.FromUserId, r.ExpectedRevision }).OrderBy(r => r.GuestId).ToArray();
        if (reassignments.Select(r => r.GuestId).Distinct().Count() != reassignments.Length || reassignments.Any(r => !guests.Contains(r.GuestId) || r.FromUserId == userId))
            throw new PlayerModerationException(400, "Reassignments must name distinct guest IDs being linked from another account.");
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new {
            userId, request.State, Reason = request.Reason.Trim(), ExpiresAt = request.ExpiresAt?.ToUniversalTime(),
            request.ExpectedRevision, guests, reassignments
        }, Json))));

        await using var connection = await source.OpenConnectionAsync(ct);
        await using var tx = await connection.BeginTransactionAsync(ct);
        // Moderation is infrequent. Serialize its writes to make multi-account guest transfers atomic
        // without lock-order races; normal gameplay never takes this lock.
        await using (var gate = new NpgsqlCommand("select pg_advisory_xact_lock(639182741)", connection, tx)) await gate.ExecuteNonQueryAsync(ct);
        await using (var retry = new NpgsqlCommand("""
            select user_id,actor_id,request_hash from public."PlayerModerationAudit"
            where request_id=@requestId and action<>'guest-reassigned' limit 1
            """, connection, tx))
        {
            retry.Parameters.AddWithValue("requestId", request.RequestId);
            bool replay;
            await using (var reader = await retry.ExecuteReaderAsync(ct))
            {
                replay = await reader.ReadAsync(ct);
                if (replay && (reader.GetGuid(0) != userId || reader.GetGuid(1) != actorId || reader.GetString(2) != hash))
                    throw new PlayerModerationException(409, "This request ID was already used for a different change.");
            }
            if (replay) return await ReadAsync(connection, tx, userId, ct);
        }
        await using (var check = new NpgsqlCommand("""
            select exists(select 1 from public."PlayerProfiles" where user_id=@userId),
              exists(select 1 from public."AdminUsers" where user_id=@userId),
              exists(select 1 from public."AdminUsers" where user_id=@actor)
            """, connection, tx))
        {
            check.Parameters.AddWithValue("userId", userId); check.Parameters.AddWithValue("actor", actorId);
            await using var reader = await check.ExecuteReaderAsync(ct); await reader.ReadAsync(ct);
            if (!reader.GetBoolean(2)) throw new PlayerModerationException(403, "Administrator access is required.");
            if (!reader.GetBoolean(0)) throw new PlayerModerationException(404, "This player no longer exists.");
            if ((request.State == "shadow_banned" || guests.Length > 0) && (actorId == userId || reader.GetBoolean(1)))
                throw new PlayerModerationException(403, "You cannot restrict yourself or an administrator account.");
        }
        if (request.ExpiresAt <= DateTimeOffset.UtcNow) throw new PlayerModerationException(400, "Choose a future expiry or leave it indefinite.");
        var before = await ReadAsync(connection, tx, userId, ct);
        if (before.Revision != request.ExpectedRevision) throw new PlayerModerationException(409, "This player's moderation changed. Reload and review before saving.");

        var owners = new Dictionary<Guid, Guid>();
        await using (var check = new NpgsqlCommand("""
            select guest_id,user_id from public."PlayerModerationGuestLinks"
            where guest_id=any(@guests) and unlinked_at is null and user_id<>@userId
            """, connection, tx))
        {
            check.Parameters.AddWithValue("guests", NpgsqlDbType.Array | NpgsqlDbType.Uuid, guests);
            check.Parameters.AddWithValue("userId", userId);
            await using var reader = await check.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct)) owners.Add(reader.GetGuid(0), reader.GetGuid(1));
        }
        if (owners.Any(o => !reassignments.Any(r => r.GuestId == o.Key && r.FromUserId == o.Value)) ||
            reassignments.Any(r => !owners.TryGetValue(r.GuestId, out var owner) || owner != r.FromUserId))
            throw new PlayerModerationException(409, "A guest association changed or belongs to another player. Preview it and explicitly confirm reassignment.");
        var previousOwners = new Dictionary<Guid, PlayerModerationState>();
        foreach (var owner in owners.Values.Distinct())
        {
            var state = await ReadAsync(connection, tx, owner, ct);
            if (reassignments.Any(r => r.FromUserId == owner && r.ExpectedRevision != state.Revision))
                throw new PlayerModerationException(409, "The previous owner's moderation changed. Preview the guest association again.");
            previousOwners.Add(owner, state);
        }
        await using (var save = new NpgsqlCommand("""
            insert into public."PlayerModeration"(user_id,state,reason,expires_at,updated_by,revision)
            values(@userId,@state,@reason,@expiry,@actor,1)
            on conflict(user_id) do update set state=excluded.state,reason=excluded.reason,expires_at=excluded.expires_at,
              updated_by=excluded.updated_by,updated_at=now(),revision=public."PlayerModeration".revision+1;
            update public."PlayerModerationGuestLinks" set unlinked_at=now(),unlinked_by=@actor
            where unlinked_at is null and ((user_id=@userId and not (guest_id=any(@guests)))
              or (user_id<>@userId and guest_id=any(@guests)));
            insert into public."PlayerModerationGuestLinks"(user_id,guest_id,linked_by,note)
            select @userId,g,@actor,@reason from unnest(@guests::uuid[]) g
            where not exists(select 1 from public."PlayerModerationGuestLinks" l where l.guest_id=g and l.unlinked_at is null);
            """, connection, tx))
        {
            save.Parameters.AddWithValue("userId", userId); save.Parameters.AddWithValue("actor", actorId);
            save.Parameters.AddWithValue("state", request.State); save.Parameters.AddWithValue("reason", request.Reason.Trim());
            save.Parameters.AddWithValue("expiry", NpgsqlDbType.TimestampTz, (object?)request.ExpiresAt?.ToUniversalTime() ?? DBNull.Value);
            save.Parameters.AddWithValue("guests", NpgsqlDbType.Array | NpgsqlDbType.Uuid, guests);
            await save.ExecuteNonQueryAsync(ct);
        }
        foreach (var (owner, previous) in previousOwners)
        {
            await using var revision = new NpgsqlCommand("update public.\"PlayerModeration\" set revision=revision+1,updated_at=now(),updated_by=@actor where user_id=@userId", connection, tx);
            revision.Parameters.AddWithValue("actor", actorId); revision.Parameters.AddWithValue("userId", owner);
            await revision.ExecuteNonQueryAsync(ct);
            await AuditAsync(connection, tx, owner, actorId, request, hash, "guest-reassigned", previous, await ReadAsync(connection, tx, owner, ct), ct);
        }
        var after = await ReadAsync(connection, tx, userId, ct);
        await AuditAsync(connection, tx, userId, actorId, request, hash, "moderation-updated", before, after, ct);
        await tx.CommitAsync(ct);
        return after;
    }

    private static async Task AuditAsync(NpgsqlConnection connection, NpgsqlTransaction tx, Guid userId, Guid actorId,
        SavePlayerModerationRequest request, string hash, string action, PlayerModerationState before, PlayerModerationState after, CancellationToken ct)
    {
        await using var command = new NpgsqlCommand("""
            insert into public."PlayerModerationAudit"(user_id,actor_id,action,reason,previous_state,new_state,request_id,request_hash)
            values(@userId,@actor,@action,@reason,@before,@after,@requestId,@hash)
            """, connection, tx);
        command.Parameters.AddWithValue("userId", userId); command.Parameters.AddWithValue("actor", actorId);
        command.Parameters.AddWithValue("action", action); command.Parameters.AddWithValue("reason", request.Reason.Trim());
        command.Parameters.AddWithValue("before", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(before, Json));
        command.Parameters.AddWithValue("after", NpgsqlDbType.Jsonb, JsonSerializer.Serialize(after, Json));
        command.Parameters.AddWithValue("requestId", request.RequestId); command.Parameters.AddWithValue("hash", hash);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<AdminPageResult<ModerationAuditEntry>> HistoryAsync(Guid userId, int page, CancellationToken ct)
    {
        await using var command = source.CreateCommand("""
            select id,actor_id,created_at,action,reason,previous_state::text,new_state::text,request_id
            from public."PlayerModerationAudit" where user_id=@userId order by id desc offset @offset limit 26
            """);
        command.Parameters.AddWithValue("userId", userId); command.Parameters.AddWithValue("offset", (page - 1) * 25);
        await using var reader = await command.ExecuteReaderAsync(ct);
        var rows = new List<ModerationAuditEntry>();
        while (await reader.ReadAsync(ct)) rows.Add(new(reader.GetInt64(0), reader.GetGuid(1), reader.GetFieldValue<DateTimeOffset>(2),
            reader.GetString(3), reader.GetString(4), JsonSerializer.Deserialize<JsonElement>(reader.GetString(5)),
            JsonSerializer.Deserialize<JsonElement>(reader.GetString(6)), reader.GetGuid(7)));
        return new(rows.Take(25).ToArray(), page, rows.Count > 25);
    }

    public async Task<GuestEvidence> GuestAsync(Guid guestId, CancellationToken ct)
    {
        await using var command = source.CreateCommand("""
            select count(p.participant_key),count(p.participant_key) filter(where p.status in ('won','lost')),max(p.updated_at),
              l.user_id,profiles.display_name,m.revision
            from (select 1) seed
            left join public."UniverseGamePlays" p on p.participant_key=@key
            left join public."PlayerModerationGuestLinks" l on l.guest_id=@guest and l.unlinked_at is null
            left join public."PlayerProfiles" profiles on profiles.user_id=l.user_id
            left join public."PlayerModeration" m on m.user_id=l.user_id
            group by l.user_id,profiles.display_name,m.revision
            """);
        command.Parameters.AddWithValue("key", $"guest:{guestId}"); command.Parameters.AddWithValue("guest", guestId);
        await using var reader = await command.ExecuteReaderAsync(ct); await reader.ReadAsync(ct);
        return new(guestId, reader.GetInt64(0), reader.GetInt64(1), Date(reader,2),
            reader.IsDBNull(3) ? null : reader.GetGuid(3), reader.IsDBNull(4) ? null : reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetInt64(5));
    }

    internal static DateTimeOffset? Date(NpgsqlDataReader reader, int i) => reader.IsDBNull(i) ? null : reader.GetFieldValue<DateTimeOffset>(i);
    private static Guid ParseGuest(string id) { LeaderboardVisibility.TryGuestId(id, out var parsed); return parsed; }
}
