import { useEffect, useState, type FormEvent } from 'react';
import type { AccountDeletionStatus, AccountSettingsValues } from '../../types/auth';
import type { BillingCheckoutPlan } from '../../types/billing';
import { AccountAvatarPicker } from './AccountAvatarPicker';

interface AccountSettingsOverlayProps {
  currentAvatarUrl: string | null;
  currentDisplayName: string;
  isPremiumUser: boolean;
  onClose: () => void;
  onDeleteAccount: () => Promise<string>;
  onOpenBillingPortal: () => Promise<void>;
  onLoadAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
  onStartCheckout: (plan: BillingCheckoutPlan) => Promise<void>;
}

export function AccountSettingsOverlay({
  currentAvatarUrl,
  currentDisplayName,
  isPremiumUser,
  onClose,
  onDeleteAccount,
  onOpenBillingPortal,
  onLoadAccountDeletionStatus,
  onSaveSettings,
  onStartCheckout,
}: AccountSettingsOverlayProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [billingMessage, setBillingMessage] = useState<string>();
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletionStatus, setDeletionStatus] = useState<AccountDeletionStatus | null>(null);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isBillingActionLoading, setIsBillingActionLoading] = useState(false);
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

  async function handleStartCheckout(plan: BillingCheckoutPlan) {
    setBillingMessage(undefined);
    setErrorMessage(undefined);
    setIsBillingActionLoading(true);

    try {
      await onStartCheckout(plan);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start checkout.');
    } finally {
      setIsBillingActionLoading(false);
    }
  }

  async function handleOpenBillingPortal() {
    setBillingMessage(undefined);
    setErrorMessage(undefined);
    setIsBillingActionLoading(true);

    try {
      await onOpenBillingPortal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open billing portal.');
    } finally {
      setIsBillingActionLoading(false);
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

          {message && <p className="auth-feedback is-success">{message}</p>}
          {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

          <button className="primary-button" disabled={isSaveDisabled} type="submit">
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        <section className="account-billing-zone" aria-labelledby="account-billing-zone-title">
          <div className="account-billing-zone-heading">
            <p className="card-kicker">Membership</p>
            <h3 id="account-billing-zone-title">{isPremiumUser ? 'Premium active' : 'Upgrade to premium'}</h3>
            <p className="muted-copy">
              {isPremiumUser
                ? 'Manage your subscription, cancellation, and payment details through Stripe.'
                : 'Unlock the full archive, ad-free play, practice mode, profile customization, and streak protection.'}
            </p>
          </div>

          {billingMessage && <p className="auth-feedback is-success">{billingMessage}</p>}

          {isPremiumUser ? (
            <button
              className="secondary-button"
              type="button"
              disabled={isBillingActionLoading}
              onClick={() => { void handleOpenBillingPortal(); }}
            >
              {isBillingActionLoading ? 'Opening...' : 'Manage Billing'}
            </button>
          ) : (
            <div className="account-billing-actions">
              <button
                className="primary-button"
                type="button"
                disabled={isBillingActionLoading}
                onClick={() => { void handleStartCheckout('monthly'); }}
              >
                {isBillingActionLoading ? 'Redirecting...' : 'Monthly Premium'}
              </button>
              <button
                className="secondary-button"
                type="button"
                disabled={isBillingActionLoading}
                onClick={() => { void handleStartCheckout('yearly'); }}
              >
                {isBillingActionLoading ? 'Redirecting...' : 'Yearly Premium'}
              </button>
            </div>
          )}
        </section>

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
