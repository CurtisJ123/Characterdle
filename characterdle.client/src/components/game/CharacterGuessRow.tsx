import type { CSSProperties } from 'react';
import { CharacterPortrait } from './CharacterPortrait';
import {
  getMobileAttributeLabel,
  type CharacterBoardAttributeGroup,
} from '../../lib/characterBoardLayout';
import type { CharacterGameRow, UniverseAttributeDefinition } from '../../types/universeGame';
import { AttributeChip } from './AttributeChip';

interface CharacterGuessRowProps {
  attributeGroups: CharacterBoardAttributeGroup[];
  getAttributeHelpText: (definition: UniverseAttributeDefinition) => string | undefined;
  gridStyle: CSSProperties;
  guess: CharacterGameRow;
}

export function CharacterGuessRow({
  attributeGroups,
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
      {attributeGroups.map((group) => {
        if (group.kind === 'identity') {
          const identityLabels = group.entries.map(({ index }) => (
            guess.cells[index]?.label ?? 'ERROR'
          ));
          const identityRevealOrderStart = Math.min(...group.entries.map(({ index }) => index));

          return (
            <div
              key={`${guess.name}-${group.key}`}
              className="guess-attribute-cell guess-attribute-cell--identity"
            >
              <span className="guess-attribute-heading">{group.label}</span>
              <div
                className="guess-identity-values"
                role="group"
                aria-label={`${group.label}: ${identityLabels.join(', ')}`}
              >
                {group.entries.map(({ definition, index }, identityIndex) => {
                  const cell = guess.cells[index] ?? { label: 'ERROR', tone: 'neutral' as const };

                  return (
                    <div
                      key={`${guess.name}-${definition.key}`}
                      className={`guess-identity-value guess-identity-value--${definition.key}`}
                    >
                      <AttributeChip
                        {...cell}
                        revealOrder={identityRevealOrderStart + identityIndex}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        const { definition, index } = group.entries[0];
        const cell = guess.cells[index] ?? { label: 'ERROR', tone: 'neutral' as const };
        const helpText = getAttributeHelpText(definition);
        const mobileLabel = getMobileAttributeLabel(definition, cell.label);

        return (
          <div
            key={`${guess.name}-${group.key}`}
            className={`guess-attribute-cell guess-attribute-cell--${group.key}`}
          >
            <span
              className={helpText ? 'guess-attribute-heading has-tooltip' : 'guess-attribute-heading'}
              tabIndex={helpText ? 0 : undefined}
            >
              {group.label}
              {helpText && (
                <span className="guess-attribute-tooltip" role="tooltip">
                  {helpText}
                </span>
              )}
            </span>
            <AttributeChip {...cell} mobileLabel={mobileLabel} />
          </div>
        );
      })}
    </div>
  );
}
