import { useEffect, useState } from 'react';

const RESEND_COOLDOWN_MS = 60_000;

interface EmailSentPanelProps {
  email: string;
  errorMessage?: string;
  isBusy: boolean;
  message: string;
  onBackToLogin: () => void;
  onResend: () => Promise<void> | void;
  sentAt: number | null;
}

function calculateSecondsRemaining(sentAt: number | null, now: number): number {
  if (sentAt === null) {
    return 0;
  }

  return Math.max(0, Math.ceil((sentAt + RESEND_COOLDOWN_MS - Math.max(now, sentAt)) / 1_000));
}

export function EmailSentPanel({
  email,
  errorMessage,
  isBusy,
  message,
  onBackToLogin,
  onResend,
  sentAt,
}: EmailSentPanelProps) {
  const [now, setNow] = useState(() => Date.now());
  const secondsRemaining = calculateSecondsRemaining(sentAt, now);

  useEffect(() => {
    if (sentAt === null) {
      return;
    }

    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (calculateSecondsRemaining(sentAt, currentTime) === 0) {
        window.clearInterval(timer);
      }
    }, 1_000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sentAt]);

  return (
    <div className="email-sent-panel auth-form">
      <p className="auth-feedback is-success" aria-live="polite">{message}</p>
      <p className="muted-copy">
        Email: <strong>{email}</strong>
      </p>

      {errorMessage && <p className="auth-feedback is-error" role="alert">{errorMessage}</p>}

      <button
        className="primary-button large-button"
        disabled={isBusy || secondsRemaining > 0}
        type="button"
        onClick={() => void onResend()}
      >
        {isBusy
          ? 'Sending...'
          : secondsRemaining > 0
            ? `Resend in ${secondsRemaining}s`
            : 'Resend email'}
      </button>

      <button className="auth-inline-button" disabled={isBusy} type="button" onClick={onBackToLogin}>
        Back to log in
      </button>
    </div>
  );
}
