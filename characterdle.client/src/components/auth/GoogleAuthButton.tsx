interface GoogleAuthButtonProps {
  disabled?: boolean;
  onClick: () => void;
}

export function GoogleAuthButton({ disabled = false, onClick }: GoogleAuthButtonProps) {
  return (
    <button
      className="secondary-button large-button google-auth-button"
      disabled={disabled}
      type="button"
      onClick={onClick}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path
          d="M21.805 10.023H12.24v3.955h5.48c-.237 1.275-.96 2.355-2.045 3.082v2.56h3.314c1.94-1.786 3.056-4.413 3.056-7.537 0-.668-.06-1.309-.24-2.06Z"
          fill="#4285F4"
        />
        <path
          d="M12.24 22c2.745 0 5.044-.909 6.726-2.38l-3.314-2.56c-.92.618-2.096.993-3.412.993-2.638 0-4.872-1.78-5.67-4.171H3.15v2.64A10.16 10.16 0 0 0 12.24 22Z"
          fill="#34A853"
        />
        <path
          d="M6.57 13.882A6.102 6.102 0 0 1 6.252 12c0-.653.114-1.286.318-1.882V7.478H3.15A10.16 10.16 0 0 0 2 12c0 1.641.392 3.195 1.15 4.522l3.42-2.64Z"
          fill="#FBBC05"
        />
        <path
          d="M12.24 5.947c1.494 0 2.835.513 3.892 1.516l2.916-2.916C17.28 2.906 14.982 2 12.24 2a10.16 10.16 0 0 0-9.09 5.478l3.42 2.64c.798-2.391 3.032-4.171 5.67-4.171Z"
          fill="#EA4335"
        />
      </svg>
      <span>Continue with Google</span>
    </button>
  );
}
