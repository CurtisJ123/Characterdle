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
        <span className={`attribute-chip-arrow is-${indicator.direction}`} aria-hidden="true">
          <span className="attribute-chip-arrow-head" />
          <span className="attribute-chip-arrow-shaft" />
        </span>
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
