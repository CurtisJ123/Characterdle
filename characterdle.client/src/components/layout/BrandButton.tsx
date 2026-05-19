interface BrandButtonProps {
  onClick: () => void;
}

export function BrandButton({ onClick }: BrandButtonProps) {
  return (
    <button className="brand-button" type="button" onClick={onClick}>
      <span className="brand-mark" aria-hidden="true" />
      Characterdle
    </button>
  );
}
