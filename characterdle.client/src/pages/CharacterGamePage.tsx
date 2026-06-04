import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import calendarDaysIcon from '../assets/calendar-days-heroicons.svg';
import { CharacterGameBoard } from '../components/game/CharacterGameBoard';
import { CharacterHintPanel } from '../components/game/CharacterHintPanel';
import { CharacterPortrait } from '../components/game/CharacterPortrait';
import { QuoteGameBoard } from '../components/game/QuoteGameBoard';
import { QuoteHintPills } from '../components/game/QuoteHintPills';
import { QuotePromptCard } from '../components/game/QuotePromptCard';
import { useAuth } from '../hooks/useAuth';
import { useCharacterGame } from '../hooks/useCharacterGame';
import { useQuoteGame } from '../hooks/useQuoteGame';
import { useUniverseGame } from '../hooks/useUniverseGame';
import { useUniverse } from '../hooks/useUniverse';
import { getOrderedCharacterPrefixMatches } from '../lib/characterSearch';
import { buildQuoteGameData } from '../lib/quoteGameData';
import { submitUniverseGameResult } from '../services/leaderboardApi';
import type { GameMode } from '../types/game';
import type { NavigateToPage } from '../types/routes';

interface CharacterGamePageProps {
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null) => void;
  onOpenHistory: (gameMode: GameMode) => void;
  selectedGameId: number | null;
  selectedGameMode: GameMode;
}

export function CharacterGamePage({
  onNavigate,
  onOpenGame,
  onOpenHistory,
  selectedGameId,
  selectedGameMode,
}: CharacterGamePageProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingSubmissionKeysRef = useRef(new Set<string>());
  const syncedSubmissionKeysRef = useRef(new Set<string>());
  const wasCompleteRef = useRef(false);
  const { session, user } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useUniverseGame(selectedUniverse.id, selectedGameId);
  const characterGame = useCharacterGame(data);
  const quoteGameData = useMemo(() => buildQuoteGameData(data), [data]);
  const quoteGame = useQuoteGame(quoteGameData);
  const isQuoteMode = selectedGameMode === 'quote';

  useEffect(() => {
    setQuery('');
  }, [data?.id, isQuoteMode]);

  const currentRound = isQuoteMode
    ? quoteGame
    : characterGame;
  const currentCharacters = isQuoteMode
    ? (quoteGameData?.characters ?? [])
    : (data?.characters ?? []);
  const isUnavailable = isQuoteMode
    ? !quoteGameData
    : !data;

  const guessableCharacters = currentCharacters.filter(
    (character) => !currentRound.guessedCharacterIds.includes(character.id),
  );
  const matchingCharacters = deferredQuery
    ? getOrderedCharacterPrefixMatches(guessableCharacters, deferredQuery).slice(0, 8)
    : [];

  const attributeCount = data?.attributeDefinitions.length ?? 0;
  const tableGridStyle = useMemo<CSSProperties>(() => ({
    gridTemplateColumns: `minmax(212px, 1.24fr) repeat(${Math.max(attributeCount, 1)}, minmax(92px, 1fr))`,
  }), [attributeCount]);
  const isComplete = currentRound.status !== 'playing';

  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      resultPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }

    wasCompleteRef.current = isComplete;
  }, [isComplete]);

  useEffect(() => {
    if (
      !data
      || !session?.access_token
      || !user
      || characterGame.status === 'playing'
      || characterGame.hintCount > 0
    ) {
      return;
    }

    const currentGame = data;
    const accessToken = session.access_token;
    const finalizedStatus = characterGame.status;
    const submissionKey = [
      user.id,
      currentGame.universeId,
      currentGame.id,
      'character',
      finalizedStatus,
      characterGame.guessCount,
      characterGame.hintCount,
    ].join(':');

    if (
      syncedSubmissionKeysRef.current.has(submissionKey)
      || pendingSubmissionKeysRef.current.has(submissionKey)
    ) {
      return;
    }

    pendingSubmissionKeysRef.current.add(submissionKey);

    async function syncResult() {
      try {
        await submitUniverseGameResult(accessToken, {
          gameId: currentGame.id,
          guessCount: characterGame.guessCount,
          hintCount: characterGame.hintCount,
          mode: 'character',
          status: finalizedStatus,
          universeId: currentGame.universeId,
        });
        syncedSubmissionKeysRef.current.add(submissionKey);
      } catch (submissionError) {
        console.error(submissionError);
      } finally {
        pendingSubmissionKeysRef.current.delete(submissionKey);
      }
    }

    void syncResult();
  }, [
    characterGame.guessCount,
    characterGame.hintCount,
    characterGame.status,
    data,
    session?.access_token,
    user,
  ]);

  useEffect(() => {
    if (
      !quoteGameData
      || !session?.access_token
      || !user
      || quoteGame.status === 'playing'
      || quoteGame.hintCount > 0
    ) {
      return;
    }

    const currentQuoteGame = quoteGameData;
    const accessToken = session.access_token;
    const finalizedStatus = quoteGame.status;
    const submissionKey = [
      user.id,
      currentQuoteGame.universeId,
      currentQuoteGame.gameId,
      'quote',
      finalizedStatus,
      quoteGame.guessCount,
      quoteGame.hintCount,
    ].join(':');

    if (
      syncedSubmissionKeysRef.current.has(submissionKey)
      || pendingSubmissionKeysRef.current.has(submissionKey)
    ) {
      return;
    }

    pendingSubmissionKeysRef.current.add(submissionKey);

    async function syncResult() {
      try {
        await submitUniverseGameResult(accessToken, {
          gameId: currentQuoteGame.gameId,
          guessCount: quoteGame.guessCount,
          hintCount: quoteGame.hintCount,
          mode: 'quote',
          status: finalizedStatus,
          universeId: currentQuoteGame.universeId,
        });
        syncedSubmissionKeysRef.current.add(submissionKey);
      } catch (submissionError) {
        console.error(submissionError);
      } finally {
        pendingSubmissionKeysRef.current.delete(submissionKey);
      }
    }

    void syncResult();
  }, [
    quoteGame.guessCount,
    quoteGame.hintCount,
    quoteGame.status,
    quoteGameData,
    session?.access_token,
    user,
  ]);

  function handleGuessSubmission(guess: string) {
    const result = currentRound.submitGuess(guess);

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
    if (isQuoteMode) {
      quoteGame.resetGame();
      return;
    }

    characterGame.resetGame();
  }

  const heroTitle = selectedGameId === null
    ? isQuoteMode
      ? 'Daily Quote Game'
      : 'Daily Character Game'
    : isQuoteMode
      ? `Archive Quote Game #${selectedGameId}`
      : `Archive Character Game #${selectedGameId}`;
  const searchPlaceholder = isQuoteMode
    ? 'Guess the speaker'
    : 'Type a name';

  const searchForm = (
    <form className="search-box" aria-label="Submit a guess" onSubmit={handleSubmit}>
      <span>{isQuoteMode ? 'Quote guess' : 'Character guess'}</span>
      <div className="search-input-stack">
        <div className="search-input-row">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            disabled={isLoading || !!error || isComplete || isUnavailable}
          />
          <button
            className="primary-button search-submit"
            type="submit"
            disabled={isLoading || !!error || isComplete || isUnavailable}
          >
            Guess
          </button>
          <div className="hint-trigger-wrap">
            <button
              className="secondary-button hint-trigger-button"
              type="button"
              aria-describedby="hint-stats-tooltip"
              disabled={isLoading || !!error || isComplete || isUnavailable}
              onClick={currentRound.handleHintAction}
            >
              {currentRound.hintActionLabel}
            </button>
            <span id="hint-stats-tooltip" className="hint-trigger-tooltip" role="tooltip">
              Using hints makes this round unranked. It will not count toward your stats.
            </span>
          </div>
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
                  {character.aliases[0] && <small>{character.aliases[0]}</small>}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {currentRound.message && currentRound.status === 'playing' && (
        <p className="search-feedback" aria-live="polite">
          {currentRound.message}
        </p>
      )}
    </form>
  );

  return (
    <main className="page centered-page game-page">
      <div className="game-top-actions" aria-label="Game actions">
        <button
          className="game-action-button history-button"
          type="button"
          aria-label="View previous games"
          title="View previous games"
          onClick={() => onOpenHistory(selectedGameMode)}
        >
          <img src={calendarDaysIcon} alt="" aria-hidden="true" />
        </button>
        {user?.isAdmin && (
          <button className="game-action-button debug-reset-button" type="button" onClick={handleResetGame}>
            Debug Reset
          </button>
        )}
      </div>

      {isQuoteMode && quoteGameData ? (
        <section className="quote-mode-layout">
          <section className="game-hero is-quote">
            <p className="eyebrow">
              {selectedGameId === null
                ? `Universe: ${selectedUniverse.title}`
                : `${selectedUniverse.title} archive`}
            </p>
            <h1>{heroTitle}</h1>
            {error && <p className="error-copy">Unable to load game.</p>}
          </section>

          <QuoteHintPills hints={currentRound.revealedHints} />
          <QuotePromptCard promptText={quoteGameData.prompt.text} />
          {searchForm}

          <div ref={resultPanelRef} className="game-board-shell quote-board-shell">
            <QuoteGameBoard
              answerName={quoteGameData.answerCharacter.displayName}
              completedGameStats={quoteGame.completedGameStats}
              guessCount={quoteGame.guessCount}
              onViewLeaderboard={() => onNavigate('leaderboard')}
              rows={quoteGame.rows}
              status={quoteGame.status}
            />
          </div>
        </section>
      ) : isQuoteMode ? (
        <section className="quote-mode-layout">
          <section className="game-hero is-quote">
            <p className="eyebrow">
              {selectedGameId === null
                ? `Universe: ${selectedUniverse.title}`
                : `${selectedUniverse.title} archive`}
            </p>
            <h1>{heroTitle}</h1>
            <p className="error-copy">Quote game unavailable.</p>
          </section>
        </section>
      ) : (
        <>
          <section className="game-hero">
            <p className="eyebrow">
              {selectedGameId === null
                ? `Universe: ${selectedUniverse.title}`
                : `${selectedUniverse.title} archive`}
            </p>
            <h1>{heroTitle}</h1>
            {error && <p className="error-copy">Unable to load game.</p>}
          </section>

          {searchForm}

          {currentRound.revealedHints.length > 0 && <CharacterHintPanel hints={currentRound.revealedHints} />}

          <div ref={resultPanelRef} className="game-board-shell">
            <CharacterGameBoard
              answerName={data?.answerCharacter.displayName ?? 'ERROR'}
              attributeDefinitions={data?.attributeDefinitions ?? []}
              canContinueToQuote={!!quoteGameData}
              completedGameStats={characterGame.completedGameStats}
              gridStyle={tableGridStyle}
              guessCount={characterGame.guessCount}
              hintCount={characterGame.hintCount}
              onContinueToQuote={() => onOpenGame('quote', selectedGameId)}
              onViewLeaderboard={() => onNavigate('leaderboard')}
              rows={characterGame.rows}
              status={characterGame.status}
            />
          </div>
        </>
      )}
    </main>
  );
}
