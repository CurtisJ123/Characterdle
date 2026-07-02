import { useEffect, useRef, useState } from 'react';
import { navItems } from '../../data/navigation';
import type { AccountSettingsValues } from '../../types/auth';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';
import { StreakEmblem } from '../ui/StreakEmblem';
import { UserAvatar } from '../ui/UserAvatar';
import { AccountSettingsOverlay } from './AccountSettingsOverlay';
import { BrandButton } from './BrandButton';

interface SiteHeaderProps {
  currentStreak: number;
  currentPage: Page;
  isAuthenticated: boolean;
  isUserLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onSaveSettings: (values: AccountSettingsValues) => Promise<string>;
  onSignOut: () => Promise<void> | void;
  userAvatarUrl?: string | null;
  userDisplayName?: string;
}

export function SiteHeader({
  currentStreak,
  currentPage,
  isAuthenticated,
  isUserLoading,
  onAuthNavigate,
  onNavigate,
  onSaveSettings,
  onSignOut,
  userAvatarUrl,
  userDisplayName,
}: SiteHeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const activeNav = currentPage === 'game' ? 'launcher' : currentPage;
  const profileLabel = userDisplayName ?? (isUserLoading ? 'Loading...' : 'Log in');

  useEffect(() => {
    if (!isProfileMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  function handleProfileClick() {
    if (!isAuthenticated) {
      onAuthNavigate('login');
      return;
    }

    setIsProfileMenuOpen((isOpen) => !isOpen);
  }

  function handleProfileNavigation() {
    setIsProfileMenuOpen(false);
    onNavigate('profile');
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
                className="streak-badge"
                type="button"
                aria-label={`${currentStreak} day current streak. View profile.`}
                title={`${currentStreak} day current streak`}
                onClick={handleProfileNavigation}
              >
                <StreakEmblem showCount={false} streak={currentStreak} size="compact" />
                <span className="streak-badge-value">{currentStreak}</span>
                <span className="streak-badge-copy">
                  <strong>Day streak</strong>
                </span>
              </button>
            )}
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                className="profile-button"
                type="button"
                aria-expanded={isAuthenticated ? isProfileMenuOpen : undefined}
                aria-haspopup={isAuthenticated ? 'menu' : undefined}
                onClick={handleProfileClick}
              >
                <UserAvatar avatarUrl={userAvatarUrl} displayName={profileLabel} size="header" />
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
          currentAvatarUrl={userAvatarUrl ?? null}
          currentDisplayName={userDisplayName ?? ''}
          onClose={() => setIsSettingsOpen(false)}
          onSaveSettings={onSaveSettings}
        />
      )}
    </>
  );
}
