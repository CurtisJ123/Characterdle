import { useEffect, useState, type FormEvent } from 'react';
import type { AccountDeletionStatus, AccountSettingsValues } from '../../types/auth';
import type { NavigateToPage } from '../../types/routes';
import { useAuth } from '../../hooks/useAuth';
import { PremiumCrownIcon } from '../ui/PremiumCrownIcon';
import { AccountAvatarPicker } from './AccountAvatarPicker';

type SettingsSection = 'account' | 'premium' | 'deleteAccount';

interface AccountSettingsOverlayProps {
  currentAutoUseStreakSavers: boolean;
  currentAvatarUrl: string | null;
  currentDisplayName: string;
  isPremiumLoading: boolean;
  isPremiumUser: boolean;
  isStreakSaverSettingEnabled: boolean;
  onClose: () => void;
  onDeleteAccount: () => Promise<string>;
  onLoadAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  onNavigate: NavigateToPage;
  onOpenBillingPortal: () => Promise<void>;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
}

interface SettingsNavItem {
  id: SettingsSection;
  isDanger?: boolean;
  isPremium?: boolean;
  label: string;
}

const navItems: SettingsNavItem[] = [
  {
    id: 'account',
    label: 'Account',
  },
  {
    id: 'premium',
    isPremium: true,
    label: 'Premium',
  },
  {
    id: 'deleteAccount',
    isDanger: true,
    label: 'Delete Account',
  },
];

export function AccountSettingsOverlay({
  currentAutoUseStreakSavers,
  currentAvatarUrl,
  currentDisplayName,
  isPremiumLoading,
  isPremiumUser,
  isStreakSaverSettingEnabled,
  onClose,
  onDeleteAccount,
  onLoadAccountDeletionStatus,
  onNavigate,
  onOpenBillingPortal,
  onSaveSettings,
}: AccountSettingsOverlayProps) {
  const { requestPasswordReset, user } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [autoUseStreakSavers, setAutoUseStreakSavers] = useState(currentAutoUseStreakSavers);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deletionStatus, setDeletionStatus] = useState<AccountDeletionStatus | null>(null);
  const [displayName, setDisplayName] = useState(currentDisplayName);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletionStatusLoading, setIsDeletionStatusLoading] = useState(true);
  const [isOpeningBillingPortal, setIsOpeningBillingPortal] = useState(false);
  const [isRequestingPasswordReset, setIsRequestingPasswordReset] = useState(false);
  const [isAvatarSaving, setIsAvatarSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [isPremiumSaving, setIsPremiumSaving] = useState(false);
  const [isUsernameSaving, setIsUsernameSaving] = useState(false);
  const [savedAutoUseStreakSavers, setSavedAutoUseStreakSavers] = useState(currentAutoUseStreakSavers);
  const [savedAvatarUrl, setSavedAvatarUrl] = useState<string | null>(currentAvatarUrl);
  const [savedDisplayName, setSavedDisplayName] = useState(currentDisplayName.trim());
  const normalizedDisplayName = displayName.trim();
  const isUsernameDirty = normalizedDisplayName !== savedDisplayName;
  const isUsernameSaveDisabled = isUsernameSaving || isAvatarSaving || !normalizedDisplayName || !isUsernameDirty;
  const isPremiumSaveDisabled = isPremiumSaving;
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

  useEffect(() => {
    if (activeSection === 'deleteAccount') {
      return;
    }

    setDeleteConfirmation('');
    setIsDeleteConfirmationOpen(false);
  }, [activeSection]);

  function clearFeedback() {
    setErrorMessage(undefined);
    setMessage(undefined);
  }

  function handleSectionChange(nextSection: SettingsSection) {
    if (nextSection === 'premium') {
      if (isPremiumLoading) {
        return;
      }

      if (!isPremiumUser) {
        onClose();
        onNavigate('premium');
        return;
      }
    }

    setActiveSection(nextSection);
  }

  async function handleSaveUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUsernameSaveDisabled) {
      return;
    }

    clearFeedback();
    setIsUsernameSaving(true);

    try {
      await onSaveSettings({
        avatarUrl: savedAvatarUrl,
        autoUseStreakSavers: savedAutoUseStreakSavers,
        displayName: normalizedDisplayName,
      });
      setSavedDisplayName(normalizedDisplayName);
      setMessage('Username updated.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your profile.');
    } finally {
      setIsUsernameSaving(false);
    }
  }

  async function handleAvatarChange(nextAvatarUrl: string | null) {
    if (nextAvatarUrl === savedAvatarUrl || isAvatarSaving) {
      setAvatarUrl(nextAvatarUrl);
      return;
    }

    const previousAvatarUrl = savedAvatarUrl;
    clearFeedback();
    setAvatarUrl(nextAvatarUrl);
    setIsAvatarSaving(true);

    try {
      await onSaveSettings({
        avatarUrl: nextAvatarUrl,
        autoUseStreakSavers: savedAutoUseStreakSavers,
        displayName: savedDisplayName,
      });
      setSavedAvatarUrl(nextAvatarUrl);
      setMessage('Profile picture updated.');
    } catch (error) {
      setAvatarUrl(previousAvatarUrl);
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your profile picture.');
    } finally {
      setIsAvatarSaving(false);
    }
  }

  async function handleRequestPasswordReset() {
    if (!user?.email || isRequestingPasswordReset) {
      return;
    }

    clearFeedback();
    setIsRequestingPasswordReset(true);

    try {
      await requestPasswordReset({ email: user.email });
      setMessage('Password reset email sent. Check your inbox for the reset link.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send a password reset email.');
    } finally {
      setIsRequestingPasswordReset(false);
    }
  }

  async function handleOpenBillingPortal() {
    clearFeedback();
    setIsOpeningBillingPortal(true);

    try {
      await onOpenBillingPortal();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open billing portal.');
      setIsOpeningBillingPortal(false);
    }
  }

  async function handleSavePremiumSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isPremiumSaveDisabled) {
      return;
    }

    clearFeedback();
    setIsPremiumSaving(true);

    try {
      const resultMessage = await onSaveSettings({
        avatarUrl: savedAvatarUrl,
        autoUseStreakSavers,
        displayName: savedDisplayName,
      });
      setSavedAutoUseStreakSavers(autoUseStreakSavers);
      setMessage(resultMessage);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update your premium settings.');
    } finally {
      setIsPremiumSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (isDeleteConfirmDisabled) {
      return;
    }

    clearFeedback();
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

        <label className="account-settings-mobile-select">
          Category
          <select
            value={activeSection}
            onChange={(event) => handleSectionChange(event.target.value as SettingsSection)}
          >
            {navItems.map((item) => (
              <option
                key={item.id}
                disabled={item.id === 'premium' && isPremiumLoading}
                value={item.id}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="account-settings-layout">
          <aside className="account-settings-sidebar" aria-label="Settings categories">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={[
                  'account-settings-nav-button',
                  activeSection === item.id ? 'is-active' : '',
                  item.isPremium ? 'is-premium' : '',
                  item.isDanger ? 'is-danger' : '',
                ].filter(Boolean).join(' ')}
                type="button"
                onClick={() => handleSectionChange(item.id)}
              >
                <span className="account-settings-nav-label">
                  {item.isPremium && <PremiumCrownIcon className="account-settings-nav-icon" />}
                  <strong>{item.label}</strong>
                </span>
              </button>
            ))}
          </aside>

          <div className="account-settings-content">
            {message && <p className="auth-feedback is-success">{message}</p>}
            {errorMessage && <p className="auth-feedback is-error">{errorMessage}</p>}

            {activeSection === 'account' && (
              <form className="account-settings-form" onSubmit={handleSaveUsername}>
                <section className="account-settings-section-card">
                  <div className="account-settings-section-heading">
                    <p className="card-kicker">Profile</p>
                  </div>

                  <label>
                    Username
                    <span className="account-settings-inline-input">
                      <input
                        autoComplete="nickname"
                        autoFocus
                        name="displayName"
                        required
                        type="text"
                        value={displayName}
                        onChange={(event) => setDisplayName(event.target.value)}
                      />
                      <button
                        className="primary-button account-settings-inline-save"
                        disabled={isUsernameSaveDisabled}
                        type="submit"
                      >
                        {isUsernameSaving ? 'Saving...' : 'Save'}
                      </button>
                    </span>
                  </label>

                  <AccountAvatarPicker
                    isSaving={isAvatarSaving}
                    selectedAvatarUrl={avatarUrl}
                    universeId="got"
                    onChange={(nextAvatarUrl) => { void handleAvatarChange(nextAvatarUrl); }}
                  />
                </section>

                <section className="account-settings-section-card">
                  <div className="account-settings-section-heading">
                    <p className="card-kicker">Security</p>
                    <h3>Password</h3>
                    <p className="muted-copy">Email yourself a reset link.</p>
                  </div>

                  <button
                    className="secondary-button account-settings-action-button"
                    type="button"
                    disabled={isRequestingPasswordReset || !user?.email}
                    onClick={() => { void handleRequestPasswordReset(); }}
                  >
                    {isRequestingPasswordReset ? 'Sending...' : 'Send reset email'}
                  </button>
                </section>
              </form>
            )}

            {activeSection === 'premium' && isPremiumUser && (
              <form className="account-settings-form" onSubmit={handleSavePremiumSettings}>
                <section className="account-settings-section-card account-settings-section-card--premium">
                  <div className="account-settings-section-heading">
                    <p className="card-kicker">Premium</p>
                    <h3>Billing</h3>
                    <p className="muted-copy">Open the billing portal.</p>
                  </div>

                  <button
                    className="secondary-button account-settings-action-button"
                    type="button"
                    disabled={isOpeningBillingPortal}
                    onClick={() => { void handleOpenBillingPortal(); }}
                  >
                    {isOpeningBillingPortal ? 'Opening...' : 'Manage billing'}
                  </button>
                </section>

                <section className={`account-settings-toggle-panel${isStreakSaverSettingEnabled ? '' : ' is-locked'}`}>
                  <div className="account-settings-toggle-copy">
                    <p className="card-kicker">Streak protection</p>
                    <h3>Auto-use streak savers</h3>
                    <p className="muted-copy">Spend one automatically if you miss a daily character game.</p>
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
                      Premium required.
                    </p>
                  )}
                </section>

                <button className="primary-button account-settings-submit" disabled={isPremiumSaveDisabled} type="submit">
                  {isPremiumSaving ? 'Saving...' : 'Save premium settings'}
                </button>
              </form>
            )}

            {activeSection === 'deleteAccount' && (
              <section className="account-danger-zone" aria-labelledby="account-danger-zone-title">
                <div className="account-danger-zone-heading">
                  <p className="card-kicker">Danger zone</p>
                  <h3 id="account-danger-zone-title">Delete account</h3>
                  <p className="muted-copy">This permanently removes your profile and saved progress.</p>
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
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
