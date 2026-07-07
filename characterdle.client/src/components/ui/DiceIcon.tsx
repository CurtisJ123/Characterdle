interface DiceIconProps {
  className?: string;
}

export function DiceIcon({ className }: DiceIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g opacity="0.94">
        <rect x="7" y="16" width="24" height="24" rx="6" stroke="currentColor" strokeWidth="4" />
        <circle cx="15.5" cy="24.5" r="2.5" fill="currentColor" />
        <circle cx="22.5" cy="31.5" r="2.5" fill="currentColor" />
      </g>
      <g>
        <rect x="29" y="24" width="28" height="28" rx="7" stroke="currentColor" strokeWidth="4" />
        <circle cx="37.5" cy="32.5" r="2.75" fill="currentColor" />
        <circle cx="48.5" cy="32.5" r="2.75" fill="currentColor" />
        <circle cx="37.5" cy="43.5" r="2.75" fill="currentColor" />
        <circle cx="48.5" cy="43.5" r="2.75" fill="currentColor" />
      </g>
    </svg>
  );
}
