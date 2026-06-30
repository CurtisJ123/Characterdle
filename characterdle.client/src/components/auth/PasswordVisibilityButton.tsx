interface PasswordVisibilityButtonProps {
  isVisible: boolean;
  onToggle: () => void;
}

export function PasswordVisibilityButton({ isVisible, onToggle }: PasswordVisibilityButtonProps) {
  const label = isVisible ? 'Hide password' : 'Show password';

  return (
    <button
      className="password-visibility-button"
      type="button"
      aria-label={label}
      aria-pressed={isVisible}
      title={label}
      onClick={onToggle}
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M2.25 12S5.75 5.25 12 5.25 21.75 12 21.75 12 18.25 18.75 12 18.75 2.25 12 2.25 12Z" />
        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        {isVisible && <path d="m3 3 18 18" />}
      </svg>
    </button>
  );
}
