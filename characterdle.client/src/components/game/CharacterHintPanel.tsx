import type { CharacterGameHint } from '../../types/universeGame';

interface CharacterHintPanelProps {
  actionLabel: string;
  hints: CharacterGameHint[];
  isDisabled: boolean;
  onAction: () => void;
}

export function CharacterHintPanel({
  actionLabel,
  hints,
  isDisabled,
  onAction,
}: CharacterHintPanelProps) {
  return (
    <section className="hint-panel glass-card" aria-label="Hints">
      <div className="hint-panel-header">
        <div>
          <p className="card-kicker">Hints</p>
          <h2>{hints.length === 0 ? 'No hints used' : `${hints.length} hint${hints.length === 1 ? '' : 's'} revealed`}</h2>
        </div>

        <button className="secondary-button hint-action-button" type="button" disabled={isDisabled} onClick={onAction}>
          {actionLabel}
        </button>
      </div>

      {hints.length > 0 && (
        <div className="hint-list" aria-label="Revealed hints">
          {hints.map((hint) => (
            <article key={hint.id} className="hint-card">
              <span>{hint.label}</span>
              <strong>{hint.value}</strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
