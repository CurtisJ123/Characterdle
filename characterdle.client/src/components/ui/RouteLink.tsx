import type { AnchorHTMLAttributes } from 'react';
import { navigateFromLink } from '../../lib/linkNavigation';

interface RouteLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href' | 'onClick'> {
  href: string;
  onNavigate?: () => void;
}

export function RouteLink({ className, href, onNavigate, target, download, ...props }: RouteLinkProps) {
  return (
    <a
      {...props}
      className={`route-link${className ? ` ${className}` : ''}`}
      href={href}
      target={target}
      download={download}
      onClick={(event) => navigateFromLink(event, onNavigate, target, download)}
    />
  );
}
