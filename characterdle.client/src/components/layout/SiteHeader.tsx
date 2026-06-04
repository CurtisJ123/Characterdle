import { navItems } from '../../data/navigation';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';
import { BrandButton } from './BrandButton';

interface SiteHeaderProps {
  currentPage: Page;
  isAuthenticated: boolean;
  isUserLoading: boolean;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
  onSignOut: () => Promise<void> | void;
  userDisplayName?: string;
}

export function SiteHeader({
  currentPage,
  isAuthenticated,
  isUserLoading,
  onAuthNavigate,
  onNavigate,
  onSignOut,
  userDisplayName,
}: SiteHeaderProps) {
  const activeNav = currentPage === 'game' ? 'launcher' : currentPage;
  const profileLabel = userDisplayName ?? (isUserLoading ? 'Loading...' : 'Log in');

  return (
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
          <button
            className="profile-button"
            type="button"
            onClick={() => (isAuthenticated ? onNavigate('profile') : onAuthNavigate('login'))}
          >
            <span>{profileLabel}</span>
          </button>
          <button
            className="icon-button"
            data-label={isAuthenticated ? 'Out' : 'Join'}
            type="button"
            onClick={() => (isAuthenticated ? onSignOut() : onAuthNavigate('signup'))}
          >
            {isAuthenticated ? 'Log out' : 'Sign up'}
          </button>
        </div>
      </div>
    </header>
  );
}
