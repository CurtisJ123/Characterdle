interface LoadingOverlayProps {
  message: string;
  title: string;
}

export function LoadingOverlay({ message, title }: LoadingOverlayProps) {
  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-label={title}>
      <section className="loading-overlay-card">
        <img
          className="loading-overlay-logo"
          src="/brand/characterdle-logo.png"
          alt=""
          aria-hidden="true"
        />
        <p className="loading-overlay-kicker">Characterdle</p>
        <h2>{title}</h2>
        <p>{message}</p>
      </section>
    </div>
  );
}
