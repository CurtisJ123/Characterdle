using Npgsql;

namespace Characterdle.Server.Features.Billing;

public sealed class BillingRepository(NpgsqlDataSource dataSource) : IBillingRepository
{
    public async Task<string?> GetStripeCustomerIdAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select stripe_customer_id
            from public."UserPremiumStatus"
            where user_id = @userId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        var result = await command.ExecuteScalarAsync(cancellationToken);

        return result as string;
    }

    public async Task<Guid?> GetUserIdByStripeCustomerIdAsync(
        string stripeCustomerId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select user_id
            from public."UserPremiumStatus"
            where stripe_customer_id = @stripeCustomerId;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("stripeCustomerId", stripeCustomerId);
        var result = await command.ExecuteScalarAsync(cancellationToken);

        return result is Guid userId ? userId : null;
    }

    public async Task<bool> HasStartedPremiumAsync(
        Guid userId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select exists(
              select 1
              from public."UserPremiumStatus"
              where user_id = @userId
                and (
                  premium_started_at is not null
                  or stripe_subscription_id is not null
                )
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }

    public async Task<bool> HasProcessedWebhookEventAsync(
        string eventId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            select exists(
              select 1
              from public."StripeWebhookEvents"
              where event_id = @eventId
            );
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("eventId", eventId);

        return await command.ExecuteScalarAsync(cancellationToken) is true;
    }

    public async Task UpsertStripeCustomerIdAsync(
        Guid userId,
        string stripeCustomerId,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."UserPremiumStatus" (
              user_id,
              is_premium,
              status,
              stripe_customer_id,
              updated_at
            )
            values (
              @userId,
              false,
              'inactive',
              @stripeCustomerId,
              timezone('utc', now())
            )
            on conflict (user_id) do update
            set
              stripe_customer_id = excluded.stripe_customer_id,
              updated_at = timezone('utc', now());
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("stripeCustomerId", stripeCustomerId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpsertPremiumStatusAsync(
        Guid userId,
        StripePremiumStatusSnapshot snapshot,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."UserPremiumStatus" (
              user_id,
              is_premium,
              status,
              stripe_customer_id,
              stripe_subscription_id,
              current_period_start,
              current_period_end,
              cancel_at,
              cancel_at_period_end,
              premium_started_at,
              premium_ended_at,
              updated_at
            )
            values (
              @userId,
              @isPremium,
              @status,
              @stripeCustomerId,
              @stripeSubscriptionId,
              @currentPeriodStart,
              @currentPeriodEnd,
              @cancelAt,
              @cancelAtPeriodEnd,
              @premiumStartedAt,
              @premiumEndedAt,
              timezone('utc', now())
            )
            on conflict (user_id) do update
            set
              is_premium = excluded.is_premium,
              status = excluded.status,
              stripe_customer_id = coalesce(excluded.stripe_customer_id, public."UserPremiumStatus".stripe_customer_id),
              stripe_subscription_id = excluded.stripe_subscription_id,
              current_period_start = excluded.current_period_start,
              current_period_end = excluded.current_period_end,
              cancel_at = excluded.cancel_at,
              cancel_at_period_end = excluded.cancel_at_period_end,
              premium_started_at = case
                when public."UserPremiumStatus".stripe_subscription_id is distinct from excluded.stripe_subscription_id
                  then coalesce(excluded.premium_started_at, excluded.current_period_start, public."UserPremiumStatus".premium_started_at)
                else coalesce(public."UserPremiumStatus".premium_started_at, excluded.premium_started_at, excluded.current_period_start)
              end,
              premium_ended_at = excluded.premium_ended_at,
              updated_at = timezone('utc', now());
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("userId", userId);
        command.Parameters.AddWithValue("isPremium", snapshot.IsPremium);
        command.Parameters.AddWithValue("status", snapshot.Status);
        command.Parameters.AddWithValue("stripeCustomerId", (object?)snapshot.StripeCustomerId ?? DBNull.Value);
        command.Parameters.AddWithValue("stripeSubscriptionId", (object?)snapshot.StripeSubscriptionId ?? DBNull.Value);
        command.Parameters.AddWithValue("currentPeriodStart", (object?)snapshot.CurrentPeriodStart ?? DBNull.Value);
        command.Parameters.AddWithValue("currentPeriodEnd", (object?)snapshot.CurrentPeriodEnd ?? DBNull.Value);
        command.Parameters.AddWithValue("cancelAt", (object?)snapshot.CancelAt ?? DBNull.Value);
        command.Parameters.AddWithValue("cancelAtPeriodEnd", snapshot.CancelAtPeriodEnd);
        command.Parameters.AddWithValue("premiumStartedAt", (object?)snapshot.PremiumStartedAt ?? DBNull.Value);
        command.Parameters.AddWithValue("premiumEndedAt", (object?)snapshot.PremiumEndedAt ?? DBNull.Value);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task RecordProcessedWebhookEventAsync(
        string eventId,
        string eventType,
        CancellationToken cancellationToken)
    {
        const string sql =
            """
            insert into public."StripeWebhookEvents" (
              event_id,
              event_type
            )
            values (
              @eventId,
              @eventType
            )
            on conflict (event_id) do nothing;
            """;

        await using var command = dataSource.CreateCommand(sql);
        command.Parameters.AddWithValue("eventId", eventId);
        command.Parameters.AddWithValue("eventType", eventType);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
