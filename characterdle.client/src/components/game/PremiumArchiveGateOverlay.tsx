import type { BillingCheckoutPlan } from '../../types/billing';

interface PremiumArchiveGateOverlayProps {
  featureLabel?: string;
  gameLabel: string;
  headline?: string;
  message?: string;
  onGoHome: () => void;
  onStartCheckout?: (plan: BillingCheckoutPlan) => Promise<void>;
}

export function PremiumArchiveGateOverlay({
  featureLabel = 'Premium archive',
  gameLabel,
  headline = 'Subscribe to premium to play.',
  message = `Premium members can play every archived ${gameLabel.toLowerCase()} board. Free players can replay the most recent daily boards.`,
  onGoHome,
  onStartCheckout,
}: PremiumArchiveGateOverlayProps) {
  return (
    <div
      className="premium-archive-gate-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Premium archive required"
    >
      <div className="premium-archive-gate-overlay-scrim" />
      <article className="premium-archive-gate-panel glass-card">
        <p className="card-kicker">{featureLabel}</p>
        <h2>{headline}</h2>
        <p className="muted-copy">
          {message}
        </p>
        <div className="premium-archive-gate-actions">
          {onStartCheckout && (
            <>
              <button className="primary-button" type="button" onClick={() => { void onStartCheckout('monthly'); }}>
                Monthly Premium
              </button>
              <button className="secondary-button" type="button" onClick={() => { void onStartCheckout('yearly'); }}>
                Yearly Premium
              </button>
            </>
          )}
          <button className="primary-button" type="button" onClick={onGoHome}>
            Go Home
          </button>
        </div>
      </article>
    </div>
  );
}
