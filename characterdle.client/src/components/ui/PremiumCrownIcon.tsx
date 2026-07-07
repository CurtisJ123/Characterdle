interface PremiumCrownIconProps {
  className?: string;
}

export function PremiumCrownIcon({ className }: PremiumCrownIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 18.5h16l-1.4-9.3-4.4 4.1L12 6.2l-2.2 7.1-4.4-4.1L4 18.5Z"
        fill="currentColor"
      />
      <path
        d="M5.2 19.8h13.6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
      <circle cx="12" cy="4.6" fill="currentColor" r="1.2" />
      <circle cx="4.9" cy="8" fill="currentColor" r="1.2" />
      <circle cx="19.1" cy="8" fill="currentColor" r="1.2" />
    </svg>
  );
}
