import { RouteLink } from '../ui/RouteLink';

interface BrandButtonProps {
  href: string;
  onClick: () => void;
}

export function BrandButton({ href, onClick }: BrandButtonProps) {
  return (
    <RouteLink className="brand-button" href={href} onNavigate={onClick}>
      <img
        className="brand-mark"
        src="/brand/characterdle-logo.png"
        alt=""
        aria-hidden="true"
      />
      Characterdle
    </RouteLink>
  );
}
