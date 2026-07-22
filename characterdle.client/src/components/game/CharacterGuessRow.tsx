import type { CSSProperties } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import type { CharacterGameRow, UniverseAttributeDefinition } from '../../types/universeGame';
import { AttributeChip } from './AttributeChip';

interface CharacterGuessRowProps {
  attributeDefinitions: UniverseAttributeDefinition[];
  getAttributeHelpText: (definition: UniverseAttributeDefinition) => string | undefined;
  gridStyle: CSSProperties;
  guess: CharacterGameRow;
}

export function CharacterGuessRow({
  attributeDefinitions,
  getAttributeHelpText,
  gridStyle,
  guess,
}: CharacterGuessRowProps) {
  return (
    <div className="guess-row" style={gridStyle}>
      <div className="character-cell">
        <CharacterPortrait
          character={{ displayName: guess.name, portraitUrl: guess.portraitUrl ?? null }}
          variant="guess"
        />
        <strong>{guess.name}</strong>
      </div>
      {guess.cells.map((cell, index) => {
        const definition = attributeDefinitions[index];
        const attributeLabel = definition?.label ?? `Attribute ${index + 1}`;
        const helpText = definition ? getAttributeHelpText(definition) : undefined;
        const attributeKey = definition?.key ?? `unknown-${index + 1}`;

        return (
          <div
            key={`${guess.name}-${attributeKey}`}
            className={`guess-attribute-cell guess-attribute-cell--${attributeKey}`}
          >
            <span
              className={helpText ? 'guess-attribute-heading has-tooltip' : 'guess-attribute-heading'}
              tabIndex={helpText ? 0 : undefined}
            >
              {attributeLabel}
              {helpText && (
                <span className="guess-attribute-tooltip" role="tooltip">
                  {helpText}
                </span>
              )}
            </span>
            <AttributeChip {...cell} />
          </div>
        );
      })}
    </div>
  );
}
