import type { CSSProperties } from 'react';
import { CharacterGuessRow } from './CharacterGuessRow';
import { GameResultPanel } from './GameResultPanel';
import { GuestVictorySignupOverlay } from './GuestVictorySignupOverlay';
import { getCharacterBoardAttributeGroups } from '../../lib/characterBoardLayout';
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

function getAttributeHelpText(definition: UniverseAttributeDefinition): string | undefined {
  return attributeHelpTextOverrides[definition.key] ?? definition.helpText ?? undefined;
}

interface CharacterGameBoardProps {
  answerName: string;
  answerPortraitUrl?: string | null;
  attributeDefinitions: UniverseAttributeDefinition[];
  completedGameStats: CompletedGameStats;
  currentStreak: number;
  gameId: number;
  gridStyle: CSSProperties;
  guessCount: number;
  hintCount: number;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
  onViewLeaderboard: () => void;
  primaryActionLabel?: string;
  rows: CharacterGameRow[];
  secondaryActionLabel?: string;
  showHintCount?: boolean;
  showShareButton?: boolean;
  highlightPrimaryAction?: boolean;
  showGuestSignupPrompt?: boolean;
  status: CharacterGameStatus;
  universeId: string;
  universeName: string;
}

export function CharacterGameBoard({
  answerName,
  answerPortraitUrl = null,
  attributeDefinitions,
  completedGameStats,
  currentStreak,
  gameId,
  gridStyle,
  guessCount,
  hintCount,
  onPrimaryAction,
  onSecondaryAction,
  onViewLeaderboard,
  primaryActionLabel,
  rows,
  secondaryActionLabel,
  showHintCount = false,
  showShareButton = true,
  highlightPrimaryAction = false,
  showGuestSignupPrompt = false,
  status,
  universeId,
  universeName,
}: CharacterGameBoardProps) {
  const attributeGroups = getCharacterBoardAttributeGroups(attributeDefinitions);

  return (
    <section className="character-board" aria-label="Character game board">
      <section className="guess-table" aria-label="Character guesses">
        <div className="guess-header" style={gridStyle}>
          <span>Character</span>
          {attributeGroups.map((group) => {
            const definition = group.entries.length === 1
              ? group.entries[0].definition
              : null;
            const helpText = definition
              ? getAttributeHelpText(definition)
              : undefined;

            return (
              <span
                key={group.key}
                className={helpText ? 'guess-header-label has-tooltip' : 'guess-header-label'}
                tabIndex={helpText ? 0 : undefined}
              >
                <span className="guess-header-label-text">{group.label}</span>
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
            <CharacterGuessRow
              key={guess.name}
              attributeGroups={attributeGroups}
              getAttributeHelpText={getAttributeHelpText}
              gridStyle={gridStyle}
              guess={guess}
            />
          ))
        ) : (
          <div className="empty-guess-state">
            <span className="material-symbols-outlined empty-guess-state-mark" aria-hidden="true">
              history_edu
            </span>
            <span className="empty-guess-state-title">No guesses yet.</span>
            <span className="empty-guess-state-copy">
              Search for a character above, then make your first guess.
            </span>
          </div>
        )}
      </section>

      {status !== 'playing' && (
        <GameResultPanel
          answerName={answerName}
          answerPortraitUrl={answerPortraitUrl}
          averageGuesses={completedGameStats.averageGuesses}
          guessCount={guessCount}
          hintCount={hintCount}
          playCount={completedGameStats.playCount}
          sharePayload={{
            gameId,
            guessCount,
            hintCount,
            mode: 'character',
            rows,
            streak: currentStreak,
            status: status as Extract<CharacterGameStatus, 'won' | 'lost'>,
            universeId,
            universeName,
          }}
          showHintCount={showHintCount}
          showShareButton={showShareButton}
          highlightPrimaryAction={highlightPrimaryAction}
          primaryActionLabel={primaryActionLabel}
          primaryTitle="Correct"
          onPrimaryAction={onPrimaryAction ?? onViewLeaderboard}
          onSecondaryAction={onSecondaryAction}
          secondaryActionLabel={secondaryActionLabel}
          status={status}
        />
      )}

      {showGuestSignupPrompt && <GuestVictorySignupOverlay />}
    </section>
  );
}
