import { navItems } from '../../data/prototypeData';
import type { AuthMode, NavigateToPage, Page } from '../../types/routes';
import { BrandButton } from './BrandButton';

interface SiteHeaderProps {
  currentPage: Page;
  onAuthNavigate: (mode: AuthMode) => void;
  onNavigate: NavigateToPage;
}

export function SiteHeader({ currentPage, onAuthNavigate, onNavigate }: SiteHeaderProps) {
  const activeNav = currentPage === 'game' || currentPage === 'quote' ? 'launcher' : currentPage;

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
          <button className="icon-button" type="button" onClick={() => onAuthNavigate('login')}>Profile</button>
          <button className="icon-button" type="button">Settings</button>
        </div>
      </div>
    </header>
  );
}
