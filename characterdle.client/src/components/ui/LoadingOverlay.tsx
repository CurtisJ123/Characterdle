import { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  message: string;
  title: string;
}

export function LoadingOverlay({ message, title }: LoadingOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Every game uses the same delay so fast or cached loads do not flash an overlay.
    const timer = window.setTimeout(() => setIsVisible(true), 250);
    return () => window.clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div className="loading-overlay" role="status" aria-live="polite" aria-label={title}>
      <section className="loading-overlay-card">
        <img
          className="loading-overlay-logo"
          src="/brand/characterdle-logo-small.webp"
          width={64}
          height={64}
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
