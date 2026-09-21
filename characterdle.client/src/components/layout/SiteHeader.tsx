import { lazy, useEffect, useRef, useState } from 'react';
import { navItems } from '../../data/navigation';
import { buildRoutePath } from '../../lib/routePaths';
import type { GameMode } from '../../types/game';
import type { AccountDeletionStatus, AccountSettingsValues } from '../../types/auth';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';
import { StreakProgressDropdown } from './StreakProgressDropdown';
import { StreakEmblem } from '../ui/StreakEmblem';
import { UserAvatar } from '../ui/UserAvatar';
import { DeferredContent } from '../ui/DeferredContent';
import { BrandButton } from './BrandButton';
import { PremiumCrownIcon } from '../ui/PremiumCrownIcon';
import { RouteLink } from '../ui/RouteLink';

const AccountSettingsOverlay = lazy(() => import('./AccountSettingsOverlay').then(module => ({ default: module.AccountSettingsOverlay })));

interface SiteHeaderProps {
  hasUnreadUpdates?: boolean;
  isAdmin?: boolean;
  autoUseStreakSavers: boolean;
  availableStreakSavers: number;
  currentStreak: number;
  currentPage: Page;
  currentGameMode: GameMode;
  universeId: string;
  isPremiumActive: boolean;
  isPremiumLoading: boolean;
  isPremiumUser: boolean;
  currentStreakSaverSettingEnabled: boolean;
  hasStreakProtection: boolean;
  isAuthenticated: boolean;
  isUserLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onDeleteAccount: () => Promise<string>;
  onLoadAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  onNavigate: NavigateToPage;
  onOpenBillingPortal: () => Promise<void>;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
  onSignOut: () => Promise<void> | void;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
}

export function SiteHeader({
  hasUnreadUpdates = false,
  isAdmin = false,
  autoUseStreakSavers,
  availableStreakSavers,
  currentStreak,
  currentPage,
  currentGameMode,
  universeId,
  isPremiumActive,
  isPremiumLoading,
  isPremiumUser,
  currentStreakSaverSettingEnabled,
  hasStreakProtection,
  isAuthenticated,
  isUserLoading,
  onAuthNavigate,
  onDeleteAccount,
  onLoadAccountDeletionStatus,
  onNavigate,
  onOpenBillingPortal,
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
  const canShowPremiumCta = isAuthenticated && !isPremiumLoading && !isPremiumActive;

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
          <BrandButton href="/home" onClick={() => onNavigate('launcher')} />

          <nav className="main-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <RouteLink
                key={item.id}
                className={`nav-button ${activeNav === item.id ? 'is-active' : ''}`}
                href={buildRoutePath({ page: item.id, universeId, gameMode: currentGameMode, gameId: null, authMode: 'login' })}
                aria-current={activeNav === item.id ? 'page' : undefined}
                onNavigate={() => onNavigate(item.id)}
              >
                {item.label}
              </RouteLink>
            ))}
          </nav>

          <div className="header-actions" aria-label="Account actions">
            <button className="updates-header-button" type="button" onClick={() => onNavigate('updates')}
              aria-label={hasUnreadUpdates ? 'Updates, new announcement' : 'Updates'} aria-haspopup="dialog">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 5h16v15H4zM7 9h10M7 13h10M7 17h6M8 2v3M16 2v3" /></svg>
              <span>Updates</span>{hasUnreadUpdates && <i aria-hidden="true" />}
            </button>
            {canShowPremiumCta && (
              <RouteLink
                className={`premium-cta-button${currentPage === 'premium' ? ' is-active' : ''}`}
                href="/premium"
                onNavigate={() => onNavigate('premium')}
              >
                <PremiumCrownIcon className="premium-cta-icon" />
                <span className="premium-cta-copy">
                  <strong>Go Premium</strong>
                  <span>
                    Under <span className="premium-cta-price">50¢</span> a week
                  </span>
                </span>
              </RouteLink>
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
                  {isAdmin && <button type="button" role="menuitem" onClick={() => { setIsProfileMenuOpen(false); onNavigate('admin'); }}>Admin</button>}
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
        <DeferredContent>
        <AccountSettingsOverlay
          currentAutoUseStreakSavers={autoUseStreakSavers}
          currentAvatarUrl={userAvatarUrl ?? null}
          currentDisplayName={userDisplayName ?? ''}
          isPremiumLoading={isPremiumLoading}
          isPremiumUser={isPremiumUser}
          isStreakSaverSettingEnabled={currentStreakSaverSettingEnabled}
          onClose={() => setIsSettingsOpen(false)}
          onDeleteAccount={onDeleteAccount}
          onLoadAccountDeletionStatus={onLoadAccountDeletionStatus}
          onNavigate={onNavigate}
          onOpenBillingPortal={onOpenBillingPortal}
          onSaveSettings={onSaveSettings}
        />
        </DeferredContent>
      )}
    </>
  );
}
