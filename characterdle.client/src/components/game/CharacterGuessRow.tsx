import type { CharacterGuess } from '../../types/game';
import { AttributeChip } from './AttributeChip';

interface CharacterGuessRowProps {
  guess: CharacterGuess;
}

export function CharacterGuessRow({ guess }: CharacterGuessRowProps) {
  return (
    <div className="guess-row">
      <div className="character-cell">
        <span className="character-orb" aria-hidden="true" />
        <strong>{guess.name}</strong>
      </div>
      <AttributeChip {...guess.house} />
      <AttributeChip {...guess.culture} />
      <AttributeChip {...guess.region} />
      <AttributeChip {...guess.allegiance} />
      <AttributeChip {...guess.debut} />
    </div>
  );
}
