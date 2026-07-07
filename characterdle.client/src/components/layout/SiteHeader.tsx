import { useEffect, useRef, useState } from 'react';
import { navItems } from '../../data/navigation';
import type { AccountDeletionStatus, AccountSettingsValues } from '../../types/auth';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';
import { StreakProgressDropdown } from './StreakProgressDropdown';
import { StreakEmblem } from '../ui/StreakEmblem';
import { UserAvatar } from '../ui/UserAvatar';
import { AccountSettingsOverlay } from './AccountSettingsOverlay';
import { BrandButton } from './BrandButton';
import { PremiumCrownIcon } from '../ui/PremiumCrownIcon';

interface SiteHeaderProps {
  autoUseStreakSavers: boolean;
  availableStreakSavers: number;
  currentStreak: number;
  currentPage: Page;
  currentStreakSaverSettingEnabled: boolean;
  hasStreakProtection: boolean;
  isAuthenticated: boolean;
  isPremiumUser: boolean;
  isUserLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onDeleteAccount: () => Promise<string>;
  onLoadAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  onNavigate: NavigateToPage;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
  onSignOut: () => Promise<void> | void;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
}

export function SiteHeader({
  autoUseStreakSavers,
  availableStreakSavers,
  currentStreak,
  currentPage,
  currentStreakSaverSettingEnabled,
  hasStreakProtection,
  isAuthenticated,
  isPremiumUser,
  isUserLoading,
  onAuthNavigate,
  onDeleteAccount,
  onLoadAccountDeletionStatus,
  onNavigate,
  onSaveSettings,
  onSignOut,
  userAvatarUrl,
  userDisplayName,
}: SiteHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStreakMenuOpen, setIsStreakMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const streakMenuRef = useRef<HTMLDivElement>(null);
  const activeNav = currentPage === 'game' || currentPage === 'random' ? 'launcher' : currentPage;
  const profileLabel = userDisplayName ?? (isUserLoading ? 'Loading...' : 'Log in');

  useEffect(() => {
    if (!isProfileMenuOpen && !isStreakMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }

      if (!streakMenuRef.current?.contains(event.target as Node)) {
        setIsStreakMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsStreakMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen, isStreakMenuOpen]);

  function handleProfileClick() {
    if (!isAuthenticated) {
      onAuthNavigate('login');
      return;
    }

    setIsStreakMenuOpen(false);
    setIsProfileMenuOpen((isOpen) => !isOpen);
  }

  function handleProfileNavigation() {
    setIsProfileMenuOpen(false);
    onNavigate('profile');
  }

  function handleStreakToggle() {
    setIsProfileMenuOpen(false);
    setIsStreakMenuOpen((isOpen) => !isOpen);
  }

  function handleSettingsOpen() {
    setIsProfileMenuOpen(false);
    setIsSettingsOpen(true);
  }

  function handleSignOut() {
    setIsProfileMenuOpen(false);
    void onSignOut();
  }

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <BrandButton onClick={() => onNavigate('launcher')} />

          <nav className="main-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-button ${activeNav === item.id ? 'is-active' : ''}`}
                type="button"
                aria-current={activeNav === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-actions" aria-label="Account actions">
            {isAuthenticated && (
              <button
                className={`premium-cta-button${currentPage === 'premium' ? ' is-active' : ''}`}
                type="button"
                onClick={() => onNavigate('premium')}
              >
                <PremiumCrownIcon className="premium-cta-icon" />
                <span className="premium-cta-copy">
                  <strong>Go Premium</strong>
                  <span>
                    Under <span className="premium-cta-price">50¢</span> a week
                  </span>
                </span>
              </button>
            )}
            {isAuthenticated && (
              <div className="streak-menu-wrap" ref={streakMenuRef}>
                <button
                  className="streak-badge"
                  type="button"
                  aria-expanded={isStreakMenuOpen}
                  aria-haspopup="dialog"
                  aria-label={`${currentStreak} day current streak. View streak progress.`}
                  title={`${currentStreak} day current streak`}
                  onClick={handleStreakToggle}
                >
                  <StreakEmblem showCount={false} streak={currentStreak} size="compact" />
                  <span className="streak-badge-value">{currentStreak}</span>
                  <span className="streak-badge-copy">
                    <strong>Day streak</strong>
                  </span>
                </button>
                {isStreakMenuOpen && (
                  <StreakProgressDropdown
                    autoUseStreakSavers={autoUseStreakSavers}
                    availableStreakSavers={availableStreakSavers}
                    hasStreakProtection={hasStreakProtection}
                    streak={currentStreak}
                  />
                )}
              </div>
            )}
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                className="profile-button"
                type="button"
                aria-expanded={isAuthenticated ? isProfileMenuOpen : undefined}
                aria-haspopup={isAuthenticated ? 'menu' : undefined}
                onClick={handleProfileClick}
              >
                <UserAvatar avatarUrl={userAvatarUrl} displayName={profileLabel} isPremium={isPremiumUser} size="header" />
                <span>{profileLabel}</span>
              </button>
              {isAuthenticated && isProfileMenuOpen && (
                <div className="profile-menu" role="menu" aria-label="Profile menu">
                  <button type="button" role="menuitem" onClick={handleProfileNavigation}>
                    Profile
                  </button>
                  <button type="button" role="menuitem" onClick={handleSettingsOpen}>
                    Settings
                  </button>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    Log Out
                  </button>
                </div>
              )}
            </div>
            {!isAuthenticated && (
              <button
                className="icon-button"
                data-label="Join"
                type="button"
                onClick={() => onAuthNavigate('signup')}
              >
                Sign up
              </button>
            )}
          </div>
        </div>
      </header>
      {isSettingsOpen && (
        <AccountSettingsOverlay
          currentAutoUseStreakSavers={autoUseStreakSavers}
          currentAvatarUrl={userAvatarUrl ?? null}
          currentDisplayName={userDisplayName ?? ''}
          isStreakSaverSettingEnabled={currentStreakSaverSettingEnabled}
          onClose={() => setIsSettingsOpen(false)}
          onDeleteAccount={onDeleteAccount}
          onLoadAccountDeletionStatus={onLoadAccountDeletionStatus}
          onSaveSettings={onSaveSettings}
        />
      )}
    </>
  );
}
