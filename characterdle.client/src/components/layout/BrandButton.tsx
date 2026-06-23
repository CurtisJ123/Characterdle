interface BrandButtonProps {
  onClick: () => void;
}

export function BrandButton({ onClick }: BrandButtonProps) {
  return (
    <button className="brand-button" type="button" onClick={onClick}>
      <img
        className="brand-mark"
        src="/brand/characterdle-logo.png"
        alt=""
        aria-hidden="true"
      />
      Characterdle
    </button>
  );
}
