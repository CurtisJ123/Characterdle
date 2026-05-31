import type { CSSProperties } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import type { CharacterGameRow } from '../../types/universeGame';
import { AttributeChip } from './AttributeChip';

interface CharacterGuessRowProps {
  gridStyle: CSSProperties;
  guess: CharacterGameRow;
}

export function CharacterGuessRow({ gridStyle, guess }: CharacterGuessRowProps) {
  return (
    <div className="guess-row" style={gridStyle}>
      <div className="character-cell">
        <CharacterPortrait
          character={{ displayName: guess.name, portraitUrl: guess.portraitUrl ?? null }}
          variant="guess"
        />
        <strong>{guess.name}</strong>
      </div>
      {guess.cells.map((cell, index) => (
        <AttributeChip key={`${guess.name}-${index}`} {...cell} />
      ))}
    </div>
  );
}
