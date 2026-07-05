namespace Characterdle.Server.Configuration;

public sealed class StripeOptions
{
    public const string SectionName = "Stripe";

    public string SecretKey { get; set; } = string.Empty;

    public string WebhookSecret { get; set; } = string.Empty;

    public string MonthlyPriceId { get; set; } = string.Empty;

    public string YearlyPriceId { get; set; } = string.Empty;

    public int MonthlyTrialDays { get; set; }

    public string SuccessUrl { get; set; } = string.Empty;

    public string CancelUrl { get; set; } = string.Empty;

    public string PortalReturnUrl { get; set; } = string.Empty;
}
