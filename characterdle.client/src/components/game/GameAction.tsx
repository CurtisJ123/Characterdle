import type { ReactNode } from 'react';
import { RouteLink } from '../ui/RouteLink';

interface GameActionProps {
  children: ReactNode;
  className: string;
  href?: string;
  onClick?: () => void;
}

export function GameAction({ children, className, href, onClick }: GameActionProps) {
  return href ? (
    <RouteLink className={className} href={href} onNavigate={onClick}>{children}</RouteLink>
  ) : (
    <button className={className} type="button" onClick={onClick}>{children}</button>
  );
}
