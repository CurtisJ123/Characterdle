interface SupporterBadgeProps {
  animatedFrame?: boolean;
  compact?: boolean;
}

export function SupporterBadge({ animatedFrame = false, compact = false }: SupporterBadgeProps) {
  return (
    <span className={`supporter-badge${compact ? ' is-compact' : ''}${animatedFrame ? ' is-animated-frame' : ''}`}>
      <span className="supporter-badge__label">Supporter</span>
    </span>
  );
}
