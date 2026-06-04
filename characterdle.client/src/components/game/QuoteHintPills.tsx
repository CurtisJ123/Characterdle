import type { CharacterGameHint } from '../../types/universeGame';

interface QuoteHintPillsProps {
  hints: CharacterGameHint[];
}

const hintBlueprints = [
  { id: 'quote-source', label: 'Season / Episode' },
  { id: 'quote-role', label: 'Role' },
  { id: 'first-letter', label: 'First Letter' },
];

export function QuoteHintPills({ hints }: QuoteHintPillsProps) {
  const revealedHints = new Map(hints.map((hint) => [hint.id, hint]));

  return (
    <section className="quote-hint-pills" aria-label="Quote hints">
      {hintBlueprints.map((hintBlueprint) => {
        const hint = revealedHints.get(hintBlueprint.id);

        return (
          <article
            key={hintBlueprint.id}
            className={`quote-hint-pill ${hint ? 'is-revealed' : 'is-hidden'}`}
            aria-label={hint ? `${hintBlueprint.label}: ${hint.value}` : `${hintBlueprint.label}: hidden`}
          >
            <span>{hintBlueprint.label}</span>
            <strong>{hint?.value ?? 'Locked'}</strong>
          </article>
        );
      })}
    </section>
  );
}
