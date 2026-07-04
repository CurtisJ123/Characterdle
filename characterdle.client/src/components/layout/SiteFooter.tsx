import type { NavigateToPage } from '../../types/routes';

interface SiteFooterProps {
  onNavigate?: NavigateToPage;
}

export function SiteFooter({ onNavigate }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-links">
          <a
            className="site-footer-link"
            href="https://github.com/CurtisJ123/Characterdle"
            target="_blank"
            rel="noreferrer"
            aria-label="Characterdle on GitHub"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.64 0 8.13c0 3.59 2.29 6.64 5.47 7.72.4.08.55-.18.55-.39 0-.19-.01-.83-.01-1.51-2.01.38-2.53-.5-2.69-.96-.09-.23-.48-.96-.82-1.15-.28-.16-.68-.56-.01-.57.63-.01 1.08.59 1.23.83.72 1.22 1.87.88 2.33.67.07-.53.28-.88.51-1.08-1.78-.2-3.64-.9-3.64-4.01 0-.89.31-1.62.82-2.19-.08-.2-.36-1.04.08-2.16 0 0 .67-.22 2.2.84A7.48 7.48 0 0 1 8 3.9c.68 0 1.36.09 2 .27 1.53-1.06 2.2-.84 2.2-.84.44 1.12.16 1.96.08 2.16.51.57.82 1.3.82 2.19 0 3.12-1.87 3.81-3.65 4.01.29.25.54.74.54 1.51 0 1.09-.01 1.96-.01 2.24 0 .21.15.47.55.39A8.15 8.15 0 0 0 16 8.13C16 3.64 12.42 0 8 0Z" />
            </svg>
            <span>GitHub</span>
          </a>
          {onNavigate ? (
            <button className="site-footer-link" type="button" onClick={() => onNavigate('support')}>
              Support
            </button>
          ) : (
            <a className="site-footer-link" href="/support">
              Support
            </a>
          )}
        </div>
        <strong>Characterdle</strong>
      </div>
    </footer>
  );
}
