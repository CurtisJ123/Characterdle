import type { PrimaryAuthMode } from '../../types/routes';

interface AuthModeToggleProps {
  mode: PrimaryAuthMode;
  onChange: (mode: PrimaryAuthMode) => void;
}

export function AuthModeToggle({ mode, onChange }: AuthModeToggleProps) {
  return (
    <div className="auth-toggle" role="tablist" aria-label="Authentication mode">
      <button
        className={mode === 'login' ? 'is-selected' : ''}
        type="button"
        role="tab"
        aria-selected={mode === 'login'}
        onClick={() => onChange('login')}
      >
        Log in
      </button>
      <button
        className={mode === 'signup' ? 'is-selected' : ''}
        type="button"
        role="tab"
        aria-selected={mode === 'signup'}
        onClick={() => onChange('signup')}
      >
        Sign up
      </button>
    </div>
  );
}
