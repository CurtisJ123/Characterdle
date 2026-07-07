import { useEffect, useState, type FormEvent } from 'react';
import type { AccountDeletionStatus, AccountSettingsValues } from '../../types/auth';
import { AccountAvatarPicker } from './AccountAvatarPicker';

interface AccountSettingsOverlayProps {
  currentAutoUseStreakSavers: boolean;
  currentAvatarUrl: string | null;
  currentDisplayName: string;
  isStreakSaverSettingEnabled: boolean;
  onClose: () => void;
  onDeleteAccount: () => Promise<string>;
  onLoadAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
}

export function AccountSettingsOverlay({
  currentAutoUseStreakSavers,
  currentAvatarUrl,
  currentDisplayName,
  isStreakSaverSettingEnabled,
  onClose,
  onDeleteAccount,
  onLoadAccountDeletionStatus,
  onSaveSettings,
}: AccountSettingsOverlayProps) {
  const [autoUseStreakSavers, setAutoUseStreakSavers] = useState(currentAutoUseStreakSavers);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletionStatus, setDeletionStatus] = useState<AccountDeletionStatus | null>(null);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletionStatusLoading, setIsDeletionStatusLoading] = useState(true);
  const [message, setMessage] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const normalizedDisplayName = displayName.trim();
  const isSaveDisabled = isSaving || !normalizedDisplayName;
  const isDeleteBlocked = deletionStatus?.canDelete === false;
  const isDeleteConfirmDisabled = isDeleting
    || isDeletionStatusLoading
    || isDeleteBlocked
    || deleteConfirmation.trim().toUpperCase() !== 'DELETE';

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

  useEffect(() => {
    let isMounted = true;

    async function loadDeletionStatus() {
      setIsDeletionStatusLoading(true);

      try {
        const status = await onLoadAccountDeletionStatus();

        if (!isMounted) {
          return;
        }

        setDeletionStatus(status);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setDeletionStatus({
          canDelete: false,
          hasActiveSubscription: false,
          message: error instanceof Error
            ? error.message
            : 'Unable to check whether account deletion is available right now.',
        });
      } finally {
        if (isMounted) {
          setIsDeletionStatusLoading(false);
        }
      }
    }

    void loadDeletionStatus();

    return () => {
      isMounted = false;
    };
  }, [onLoadAccountDeletionStatus]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSaveDisabled) {
      return;
    }

    setErrorMessage(undefined);
    setMessage(undefined);
    setIsSaving(true);

    try {
      const resultMessage = await onSaveSettings({
        avatarUrl,
        autoUseStreakSavers,
        displayName: normalizedDisplayName,
      });
      setMessage(resultMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (isDeleteConfirmDisabled) {
      return;
    }

    setErrorMessage(undefined);
    setMessage(undefined);
    setIsDeleting(true);

    try {
      await onDeleteAccount();
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to delete your account.');
    } finally {
      setIsDeleting(false);
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

          <AccountAvatarPicker
            selectedAvatarUrl={avatarUrl}
            universeId="got"
            onChange={setAvatarUrl}
          />

          <section className={`account-settings-toggle-panel${isStreakSaverSettingEnabled ? '' : ' is-locked'}`}>
            <div className="account-settings-toggle-copy">
              <p className="card-kicker">Streak protection</p>
              <h3>Automatic streak savers</h3>
              <p className="muted-copy">
                If enabled, an available streak saver is spent automatically when you miss a daily character game
                and it can fully preserve your streak.
              </p>
            </div>

            <label className="account-settings-toggle-control">
              <input
                checked={autoUseStreakSavers}
                disabled={!isStreakSaverSettingEnabled}
                type="checkbox"
                onChange={(event) => setAutoUseStreakSavers(event.target.checked)}
              />
              <span className="account-settings-toggle-track" aria-hidden="true">
                <span className="account-settings-toggle-thumb" />
              </span>
              <span className="account-settings-toggle-state">
                {autoUseStreakSavers ? 'On' : 'Off'}
              </span>
            </label>

            {!isStreakSaverSettingEnabled && (
              <p className="muted-copy account-settings-toggle-locked-copy">
                Premium is required before automatic streak saver controls become available.
              </p>
            )}
          </section>

          {message && <p className="auth-feedback is-success">{message}</p>}
          {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

          <button className="primary-button" disabled={isSaveDisabled} type="submit">
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        <section className="account-danger-zone" aria-labelledby="account-danger-zone-title">
          <div className="account-danger-zone-heading">
            <p className="card-kicker">Danger zone</p>
            <h3 id="account-danger-zone-title">Delete account</h3>
            <p className="muted-copy">
              This permanently removes your profile, streaks, leaderboard history, and saved results.
            </p>
          </div>

          {isDeletionStatusLoading ? (
            <p className="muted-copy">Checking deletion availability...</p>
          ) : (
            <p className={`account-danger-status${isDeleteBlocked ? ' is-blocked' : ''}`}>
              {deletionStatus?.message ?? 'Account deletion is available.'}
            </p>
          )}

          {!isDeleteConfirmationOpen ? (
            <button
              className="account-delete-trigger"
              type="button"
              disabled={isDeletionStatusLoading || isDeleteBlocked}
              onClick={() => setIsDeleteConfirmationOpen(true)}
            >
              Delete account
            </button>
          ) : (
            <div className="account-delete-confirmation">
              <label>
                Type DELETE to confirm
                <input
                  name="deleteConfirmation"
                  type="text"
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                />
              </label>

              <div className="account-delete-actions">
                <button
                  className="secondary-button"
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    setDeleteConfirmation('');
                    setIsDeleteConfirmationOpen(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="account-delete-trigger is-confirm"
                  type="button"
                  disabled={isDeleteConfirmDisabled}
                  onClick={() => {
                    void handleDeleteAccount();
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Permanently delete'}
                </button>
              </div>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
