import type { CharacterGameHint } from '../../types/universeGame';

interface CharacterHintPanelProps {
  hints: CharacterGameHint[];
  slotCount?: number;
}

export function CharacterHintPanel({
  hints,
  slotCount = 3,
}: CharacterHintPanelProps) {
  const slots = Array.from({ length: slotCount }, (_, index) => hints[index] ?? null);

  return (
    <section className="hint-strip glass-card" aria-label="Revealed hints">
      {slots.map((hint, index) => (
        <article
          key={hint?.id ?? `empty-hint-slot-${index + 1}`}
          className={hint ? 'hint-slot is-filled' : 'hint-slot is-empty'}
          aria-label={hint ? `${hint.label}: ${hint.value}` : undefined}
        >
          {hint && (
            <>
              <span>{hint.label}</span>
              <strong>{hint.value}</strong>
            </>
          )}
        </article>
      ))}
    </section>
  );
}
