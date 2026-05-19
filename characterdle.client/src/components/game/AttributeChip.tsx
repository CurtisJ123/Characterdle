import type { CharacterAttribute } from '../../types/game';

export function AttributeChip({ label, tone }: CharacterAttribute) {
  return <span className={`attribute-chip ${tone}`}>{label}</span>;
}
