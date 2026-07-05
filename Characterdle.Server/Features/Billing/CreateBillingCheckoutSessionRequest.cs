namespace Characterdle.Server.Features.Billing;

public sealed record CreateBillingCheckoutSessionRequest(
    string Plan);
