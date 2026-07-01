import { useEffect, useState, type FormEvent } from 'react';

interface AccountSettingsOverlayProps {
  currentDisplayName: string;
  onClose: () => void;
  onSaveDisplayName: (displayName: string) => Promise<string>;
}

export function AccountSettingsOverlay({
  currentDisplayName,
  onClose,
  onSaveDisplayName,
}: AccountSettingsOverlayProps) {
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [message, setMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const normalizedDisplayName = displayName.trim();
  const isSaveDisabled = isSaving || !normalizedDisplayName;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaveDisabled) {
      return;
    }

    setErrorMessage(undefined);
    setMessage(undefined);
    setIsSaving(true);

    try {
      const resultMessage = await onSaveDisplayName(normalizedDisplayName);
      setMessage(resultMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="account-settings-overlay" role="dialog" aria-modal="true" aria-labelledby="account-settings-title">
      <button
        className="account-settings-overlay-scrim"
        type="button"
        aria-label="Close settings"
        onClick={onClose}
      />

      <section className="account-settings-panel glass-card">
        <button
          className="account-settings-close"
          type="button"
          aria-label="Close settings"
          onClick={onClose}
        >
          Close
        </button>

        <div className="account-settings-heading">
          <p className="card-kicker">Account</p>
          <h2 id="account-settings-title">Settings</h2>
        </div>

        <form className="account-settings-form" onSubmit={handleSubmit}>
          <label>
            Username
            <input
              autoComplete="nickname"
              autoFocus
              name="displayName"
              required
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>

          {message && <p className="auth-feedback is-success">{message}</p>}
          {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

          <button className="primary-button" disabled={isSaveDisabled} type="submit">
            {isSaving ? 'Saving...' : 'Save username'}
          </button>
        </form>
      </section>
    </div>
  );
}
