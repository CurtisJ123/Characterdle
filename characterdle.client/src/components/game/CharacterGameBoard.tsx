import type { CSSProperties } from 'react';
import { CharacterGuessRow } from './CharacterGuessRow';
import { GameResultPanel } from './GameResultPanel';
import type {
  CharacterGameRow,
  CharacterGameStatus,
  CompletedGameStats,
  UniverseAttributeDefinition,
} from '../../types/universeGame';

const attributeHelpTextOverrides: Partial<Record<string, string>> = {
  alive: 'Character status at the end of their last present-day appearance.',
  lastSeason: 'Last season seen alive, not including flashbacks.',
};

interface CharacterGameBoardProps {
  answerName: string;
  attributeDefinitions: UniverseAttributeDefinition[];
  canContinueToQuote: boolean;
  completedGameStats: CompletedGameStats;
  gridStyle: CSSProperties;
  guessCount: number;
  hintCount: number;
  onContinueToQuote: () => void;
  onViewLeaderboard: () => void;
  rows: CharacterGameRow[];
  status: CharacterGameStatus;
}

export function CharacterGameBoard({
  answerName,
  attributeDefinitions,
  canContinueToQuote,
  completedGameStats,
  gridStyle,
  guessCount,
  hintCount,
  onContinueToQuote,
  onViewLeaderboard,
  rows,
  status,
}: CharacterGameBoardProps) {
  return (
    <section className="character-board" aria-label="Character game board">
      <section className="guess-table" aria-label="Character guesses">
        <div className="guess-header" style={gridStyle}>
          <span>Character</span>
          {attributeDefinitions.map((definition) => {
            const helpText = attributeHelpTextOverrides[definition.key] ?? definition.helpText;

            return (
              <span
                key={definition.key}
                className={helpText ? 'guess-header-label has-tooltip' : 'guess-header-label'}
                tabIndex={helpText ? 0 : undefined}
              >
                <span className="guess-header-label-text">{definition.label}</span>
                {helpText && (
                  <span className="guess-header-tooltip" role="tooltip">
                    {helpText}
                  </span>
                )}
              </span>
            );
          })}
        </div>
        {rows.length > 0 ? (
          rows.map((guess) => (
            <CharacterGuessRow key={guess.name} gridStyle={gridStyle} guess={guess} />
          ))
        ) : (
          <div className="empty-guess-state">
            No guesses yet.
          </div>
        )}
      </section>

      {status !== 'playing' && (
        <GameResultPanel
          answerName={answerName}
          averageGuesses={completedGameStats.averageGuesses}
          guessCount={guessCount}
          hintCount={hintCount}
          playCount={completedGameStats.playCount}
          primaryActionLabel={status === 'won' && canContinueToQuote ? 'Play Quote' : 'View Leaderboard'}
          primaryTitle="Correct"
          onPrimaryAction={status === 'won' && canContinueToQuote ? onContinueToQuote : onViewLeaderboard}
          onSecondaryAction={status === 'won' && canContinueToQuote ? onViewLeaderboard : undefined}
          secondaryActionLabel={status === 'won' && canContinueToQuote ? 'Leaderboard' : undefined}
          status={status}
        />
      )}
    </section>
  );
}
