import type { CharacterAttribute } from '../../types/game';

function getSizeClass(label: string): string {
  const normalizedLength = label.replace(/\s+/g, ' ').trim().length;

  if (normalizedLength >= 30) {
    return 'is-xxsmall';
  }

  if (normalizedLength >= 24) {
    return 'is-xsmall';
  }

  if (normalizedLength >= 16) {
    return 'is-small';
  }

  return '';
}

interface DirectionArrowGlyphProps {
  direction: 'up' | 'down';
}

function DirectionArrowGlyph({ direction }: DirectionArrowGlyphProps) {
  return (
    <svg
      className={`attribute-chip-arrow-glyph is-${direction}`}
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="attribute-chip-arrow-fill"
        d="M48 20L72 44H58V74H38V44H24L48 20Z"
      />
    </svg>
  );
}

export function AttributeChip({ displayVariant, indicator, label, tone }: CharacterAttribute) {
  const sizeClass = getSizeClass(label);
  const variantClass = displayVariant === 'numeric' ? 'is-numeric' : '';

  if (indicator) {
    return (
      <span
        className={`attribute-chip ${tone} ${variantClass} is-directional ${sizeClass}`.trim()}
        aria-label={label}
        title={label}
      >
        <DirectionArrowGlyph direction={indicator.direction} />
        <span className="attribute-chip-direction-value">{indicator.value}</span>
      </span>
    );
  }

  return (
    <span className={`attribute-chip ${tone} ${variantClass} ${sizeClass}`.trim()} title={label}>
      <span className="attribute-chip-label">{label}</span>
    </span>
  );
}
