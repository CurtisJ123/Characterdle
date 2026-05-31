import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import calendarDaysIcon from '../assets/calendar-days-heroicons.svg';
import { CharacterGuessRow } from '../components/game/CharacterGuessRow';
import { CharacterHintPanel } from '../components/game/CharacterHintPanel';
import { CharacterPortrait } from '../components/game/CharacterPortrait';
import { CharacterResultPanel } from '../components/game/CharacterResultPanel';
import { useCharacterGame } from '../hooks/useCharacterGame';
import { useUniverseGame } from '../hooks/useUniverseGame';
import { useUniverse } from '../hooks/useUniverse';
import { getOrderedCharacterPrefixMatches } from '../lib/characterSearch';
import type { NavigateToPage } from '../types/routes';

interface CharacterGamePageProps {
  onNavigate: NavigateToPage;
  selectedGameId: number | null;
}

export function CharacterGamePage({ onNavigate, selectedGameId }: CharacterGamePageProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const wasCompleteRef = useRef(false);
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useUniverseGame(selectedUniverse.id, selectedGameId);
  const {
    handleHintAction,
    hintActionLabel,
    hintCount,
    completedGameStats,
    guessCount,
    guessedCharacterIds,
    message,
    revealedHints,
    resetGame,
    rows,
    status,
    submitGuess,
  } = useCharacterGame(data);

  const guessableCharacters = (data?.characters ?? []).filter(
    (character) => !guessedCharacterIds.includes(character.id),
  );
  const matchingCharacters = deferredQuery
    ? getOrderedCharacterPrefixMatches(guessableCharacters, deferredQuery).slice(0, 8)
    : [];

  const attributeCount = data?.attributeDefinitions.length ?? 0;
  const tableGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `minmax(150px, 1.15fr) repeat(${Math.max(attributeCount, 1)}, minmax(0, 1fr))`,
  }), [attributeCount]);
  const isComplete = status !== 'playing';

  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      resultPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  function handleGuessSubmission(guess: string) {
    const result = submitGuess(guess);

    if (!result.accepted) {
      return;
    }

    setQuery('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    handleGuessSubmission(query);
  }

  function handleResetGame() {
    setQuery('');
    resetGame();
  }

  return (
    <main className="page centered-page game-page">
      <div className="game-top-actions" aria-label="Game actions">
        <button
          className="game-action-button history-button"
          type="button"
          aria-label="View previous games"
          title="View previous games"
          onClick={() => onNavigate('history')}
        >
          <img src={calendarDaysIcon} alt="" aria-hidden="true" />
        </button>
        <button className="game-action-button debug-reset-button" type="button" onClick={handleResetGame}>
          Debug Reset
        </button>
      </div>

      <section className="game-hero">
        <p className="eyebrow">
          {selectedGameId === null
            ? `Universe: ${selectedUniverse.title}`
            : `${selectedUniverse.title} archive`}
        </p>
        <h1>{selectedGameId === null ? 'Daily Character Game' : `Archive Game #${selectedGameId}`}</h1>
        <p>
          Type a character name, submit the guess, and use the clue grid to narrow down today&apos;s answer.
        </p>
        {error && <p className="error-copy">Unable to load today&apos;s game right now.</p>}
      </section>

      <form className="search-box" aria-label="Submit a character guess" onSubmit={handleSubmit}>
        <span>Search</span>
        <div className="search-input-stack">
          <div className="search-input-row">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Type a ${selectedUniverse.title} character name...`}
              autoComplete="off"
              disabled={isLoading || !!error || isComplete}
            />
            <button
              className="primary-button search-submit"
              type="submit"
              disabled={isLoading || !!error || isComplete}
            >
              Guess
            </button>
          </div>

          {matchingCharacters.length > 0 && (
            <div className="search-suggestions" aria-label="Matching characters">
              {matchingCharacters.map((character) => (
                <button
                  key={character.id}
                  className="suggestion-row"
                  type="button"
                  onClick={() => handleGuessSubmission(character.displayName)}
                >
                  <CharacterPortrait character={character} variant="suggestion" />
                  <span className="suggestion-copy">
                    <strong>{character.displayName}</strong>
                    <small>{character.aliases[0] ?? 'Character suggestion'}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {message && status === 'playing' && (
          <p className="search-feedback" aria-live="polite">
            {message}
          </p>
        )}
      </form>

      <div className="game-utility-row">
        <CharacterHintPanel
          actionLabel={hintActionLabel}
          hints={revealedHints}
          isDisabled={isLoading || !!error || isComplete}
          onAction={handleHintAction}
        />
      </div>

      <section className="guess-table" aria-label="Character guesses">
        <div className="guess-header" style={tableGridStyle}>
          <span>Character</span>
          {(data?.attributeDefinitions ?? []).map((definition) => (
            <span key={definition.key}>{definition.label}</span>
          ))}
        </div>
        {rows.length > 0 ? (
          rows.map((guess) => (
            <CharacterGuessRow key={guess.name} gridStyle={tableGridStyle} guess={guess} />
          ))
        ) : (
          <div className="empty-guess-state">
            Submit your first guess to start the board.
          </div>
        )}
      </section>

      {status !== 'playing' && (
        <div ref={resultPanelRef}>
          <CharacterResultPanel
            answerName={data?.answerCharacter.displayName ?? 'ERROR'}
            averageGuesses={completedGameStats.averageGuesses}
            guessCount={guessCount}
            hintCount={hintCount}
            onContinueToQuote={() => onNavigate('quote')}
            playCount={completedGameStats.playCount}
            status={status}
          />
        </div>
      )}
    </main>
  );
}
