import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import calendarDaysIcon from '../assets/calendar-days-heroicons.svg';
import questionMarkCircleIcon from '../assets/question-mark-circle-heroicons.svg';
import { CharacterGameBoard } from '../components/game/CharacterGameBoard';
import { CharacterHintPanel } from '../components/game/CharacterHintPanel';
import { CharacterPortrait } from '../components/game/CharacterPortrait';
import { QuoteGameBoard } from '../components/game/QuoteGameBoard';
import { QuoteHintPills } from '../components/game/QuoteHintPills';
import { QuotePromptCard } from '../components/game/QuotePromptCard';
import { SiteHelpOverlay } from '../components/layout/SiteHelpOverlay';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { useAuth } from '../hooks/useAuth';
import { useCharacterGame } from '../hooks/useCharacterGame';
import { useQuoteGame } from '../hooks/useQuoteGame';
import { useUniverseGameResults } from '../hooks/useUniverseGameResults';
import { useUniverseGame } from '../hooks/useUniverseGame';
import { useUniverse } from '../hooks/useUniverse';
import { getAnonymousParticipantKey } from '../lib/anonymousParticipant';
import { getRemoteGameOutcome } from '../lib/characterGameProgress';
import { getOrderedCharacterPrefixMatches } from '../lib/characterSearch';
import { buildQuoteGameData } from '../lib/quoteGameData';
import { formatQuoteEpisodeLabel } from '../lib/quotePrompt';
import { compareAttributeValue } from '../lib/universeAttributes';
import { trackUniverseGamePlay } from '../services/gamePlayTrackingApi';
import { submitUniverseGameResult } from '../services/leaderboardApi';
import type { GameMode } from '../types/game';
import type { NavigateToPage } from '../types/routes';
import type { CharacterGameRow, CurrentUniverseGame, QuoteGameRow } from '../types/universeGame';

interface CharacterGamePageProps {
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingSubmissionKeysRef = useRef(new Set<string>());
  const syncedSubmissionKeysRef = useRef(new Set<string>());
  const pendingPlayTrackingKeysRef = useRef(new Set<string>());
  const syncedPlayTrackingKeysRef = useRef(new Set<string>());
  const wasCompleteRef = useRef(false);
  const { isAuthenticated, isLoading: isAuthLoading, session, user } = useAuth();
  const { selectedUniverse } = useUniverse();
  const { data, error, isLoading } = useUniverseGame(selectedUniverse.id, selectedGameId);
  const { data: persistedResults } = useUniverseGameResults(session?.access_token ?? null, selectedUniverse.id);
  const characterGame = useCharacterGame(data);
  const quoteGameData = useMemo(() => buildQuoteGameData(data), [data]);
  const quoteGame = useQuoteGame(quoteGameData);
  const isQuoteMode = selectedGameMode === 'quote';
  const isGameLoading = isLoading && !data && !error;

  useEffect(() => {
    if (!isGameLoading) {
      setShowLoadingOverlay(false);
      return;
    }

    const overlayTimer = window.setTimeout(() => {
      setShowLoadingOverlay(true);
    }, 250);

    return () => {
      window.clearTimeout(overlayTimer);
    };
  }, [isGameLoading]);

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
  const tableGridStyle = useMemo<CSSProperties>(() => {
    const resolvedAttributeCount = Math.max(attributeCount, 1);
    const minCharacterWidth = 212;
    const minAttributeWidth = 92;
    const trackGap = 10;
    const desktopBoardWidth = 1180;
    const rowHorizontalPadding = 28;
    const flexibleWeightTotal = 1.24 + resolvedAttributeCount;
    const availableWidth = desktopBoardWidth - rowHorizontalPadding - (trackGap * resolvedAttributeCount);
    const minimumWidth = minCharacterWidth + (minAttributeWidth * resolvedAttributeCount);
    const distributableWidth = Math.max(availableWidth - minimumWidth, 0);
    const fullCharacterWidth = (
      minCharacterWidth + ((distributableWidth * 1.24) / flexibleWeightTotal)
    ).toFixed(3);
    const fullAttributeWidth = (
      minAttributeWidth + (distributableWidth / flexibleWeightTotal)
    ).toFixed(3);

    return {
      '--character-board-columns': `minmax(${minCharacterWidth}px, 1.24fr) repeat(${resolvedAttributeCount}, minmax(${minAttributeWidth}px, 1fr))`,
      '--character-board-scroll-columns': `${fullCharacterWidth}px repeat(${resolvedAttributeCount}, ${fullAttributeWidth}px)`,
    } as CSSProperties;
  }, [attributeCount]);
  const characterResult = useMemo(
    () => data
      ? persistedResults.find((result) => result.mode === 'character' && result.gameId === data.id) ?? null
      : null,
    [data, persistedResults],
  );
  const quoteResult = useMemo(
    () => quoteGameData
      ? persistedResults.find((result) => result.mode === 'quote' && result.gameId === quoteGameData.gameId) ?? null
      : null,
    [persistedResults, quoteGameData],
  );
  const remoteCharacterOutcome = characterResult
    ? getRemoteGameOutcome(characterResult.status, characterResult.completedAt)
    : 'pending';
  const remoteQuoteOutcome = quoteResult
    ? getRemoteGameOutcome(quoteResult.status, quoteResult.completedAt)
    : 'pending';
  const usesRemoteCharacterResult = !isQuoteMode && !!data && characterGame.status === 'playing' && remoteCharacterOutcome !== 'pending';
  const usesRemoteQuoteResult = isQuoteMode && !!quoteGameData && quoteGame.status === 'playing' && remoteQuoteOutcome !== 'pending';
  const displayedCharacterRows = usesRemoteCharacterResult && data
    ? [buildSolvedCharacterRow(data)]
    : characterGame.rows;
  const displayedQuoteRows = usesRemoteQuoteResult && quoteGameData
    ? [buildSolvedQuoteRow(quoteGameData)]
    : quoteGame.rows;
  const displayedCharacterStatus = usesRemoteCharacterResult && characterResult
    ? remoteCharacterOutcome
    : characterGame.status;
  const displayedQuoteStatus = usesRemoteQuoteResult && quoteResult
    ? remoteQuoteOutcome
    : quoteGame.status;
  const displayedCharacterGuessCount = usesRemoteCharacterResult && characterResult
    ? characterResult.guessCount
    : characterGame.guessCount;
  const displayedQuoteGuessCount = usesRemoteQuoteResult && quoteResult
    ? quoteResult.guessCount
    : quoteGame.guessCount;
  const displayedCharacterHintCount = usesRemoteCharacterResult && characterResult
    ? characterResult.hintCount
    : characterGame.hintCount;
  const displayedQuoteHintCount = usesRemoteQuoteResult && quoteResult
    ? quoteResult.hintCount
    : quoteGame.hintCount;
  const hasPlayedQuoteGame = quoteGame.status !== 'playing' || remoteQuoteOutcome !== 'pending';
  const hasWonCharacterGame = characterGame.status === 'won' || remoteCharacterOutcome === 'won';
  const isComplete = isQuoteMode
    ? displayedQuoteStatus !== 'playing'
    : displayedCharacterStatus !== 'playing';
  const shouldOfferQuoteFollowUp = displayedCharacterStatus === 'won' && !!quoteGameData && !hasPlayedQuoteGame;
  const shouldOfferCharacterFollowUp = displayedQuoteStatus === 'won' && !!data && !hasWonCharacterGame;
  const shouldShowGuestSignupPrompt = !isAuthLoading && !isAuthenticated;

  useEffect(() => {
    if (!isComplete) {
      wasCompleteRef.current = false;
      return;
    }

    if (wasCompleteRef.current) {
      return;
    }

    wasCompleteRef.current = true;

    const scrollTimer = window.setTimeout(() => {
      const footer = document.querySelector<HTMLElement>('footer.site-footer');

      if (footer) {
        footer.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        return;
      }

      const resultPanel = resultPanelRef.current?.querySelector<HTMLElement>('[data-result-panel="true"]');

      if (resultPanel) {
        resultPanel.scrollIntoView({
          behavior: 'smooth',
          block: 'end',
        });
        return;
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth',
      });
    }, 120);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [isComplete]);

  useEffect(() => {
    if (!data) {
      return;
    }

    const currentGame = data;
    const hasMeaningfulActivity = characterGame.guessCount > 0
      || characterGame.hintCount > 0
      || characterGame.status !== 'playing';

    if (!hasMeaningfulActivity) {
      return;
    }

    const participantKey = getAnonymousParticipantKey();
    const trackingStateKey = characterGame.status === 'playing'
      ? 'playing'
      : `${characterGame.status}:${characterGame.guessCount}:${characterGame.hintCount}`;
    const trackingKey = [
      participantKey,
      currentGame.universeId,
      currentGame.id,
      'character',
      trackingStateKey,
    ].join(':');

    if (
      syncedPlayTrackingKeysRef.current.has(trackingKey)
      || pendingPlayTrackingKeysRef.current.has(trackingKey)
    ) {
      return;
    }

    pendingPlayTrackingKeysRef.current.add(trackingKey);

    async function syncPlayTracking() {
      try {
        await trackUniverseGamePlay({
          gameId: currentGame.id,
          guessCount: characterGame.guessCount,
          hintCount: characterGame.hintCount,
          mode: 'character',
          participantKey,
          status: characterGame.status === 'playing' ? 'playing' : characterGame.status,
          universeId: currentGame.universeId,
        });
        syncedPlayTrackingKeysRef.current.add(trackingKey);
      } catch (trackingError) {
        console.error(trackingError);
      } finally {
        pendingPlayTrackingKeysRef.current.delete(trackingKey);
      }
    }

    void syncPlayTracking();
  }, [
    characterGame.guessCount,
    characterGame.hintCount,
    characterGame.status,
    data,
  ]);

  useEffect(() => {
    if (
      !data
      || !session?.access_token
      || !user
      || characterGame.status === 'playing'
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
    if (!quoteGameData) {
      return;
    }

    const currentQuoteGame = quoteGameData;
    const hasMeaningfulActivity = quoteGame.guessCount > 0
      || quoteGame.hintCount > 0
      || quoteGame.status !== 'playing';

    if (!hasMeaningfulActivity) {
      return;
    }

    const participantKey = getAnonymousParticipantKey();
    const trackingStateKey = quoteGame.status === 'playing'
      ? 'playing'
      : `${quoteGame.status}:${quoteGame.guessCount}:${quoteGame.hintCount}`;
    const trackingKey = [
      participantKey,
      currentQuoteGame.universeId,
      currentQuoteGame.gameId,
      'quote',
      trackingStateKey,
    ].join(':');

    if (
      syncedPlayTrackingKeysRef.current.has(trackingKey)
      || pendingPlayTrackingKeysRef.current.has(trackingKey)
    ) {
      return;
    }

    pendingPlayTrackingKeysRef.current.add(trackingKey);

    async function syncPlayTracking() {
      try {
        await trackUniverseGamePlay({
          gameId: currentQuoteGame.gameId,
          guessCount: quoteGame.guessCount,
          hintCount: quoteGame.hintCount,
          mode: 'quote',
          participantKey,
          status: quoteGame.status === 'playing' ? 'playing' : quoteGame.status,
          universeId: currentQuoteGame.universeId,
        });
        syncedPlayTrackingKeysRef.current.add(trackingKey);
      } catch (trackingError) {
        console.error(trackingError);
      } finally {
        pendingPlayTrackingKeysRef.current.delete(trackingKey);
      }
    }

    void syncPlayTracking();
  }, [
    quoteGame.guessCount,
    quoteGame.hintCount,
    quoteGame.status,
    quoteGameData,
  ]);

  useEffect(() => {
    if (
      !quoteGameData
      || !session?.access_token
      || !user
      || quoteGame.status === 'playing'
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

  function clearTrackingKeys(set: Set<string>, prefix: string) {
    for (const key of set) {
      if (key.startsWith(prefix)) {
        set.delete(key);
      }
    }
  }

  function handleResetGame() {
    setQuery('');

    const activeUniverseId = isQuoteMode
      ? quoteGameData?.universeId
      : data?.universeId;
    const activeGameId = isQuoteMode
      ? quoteGameData?.gameId
      : data?.id;

    if (activeUniverseId && activeGameId) {
      const anonymousParticipantKey = getAnonymousParticipantKey();
      const playTrackingPrefix = [
        anonymousParticipantKey,
        activeUniverseId,
        activeGameId,
        selectedGameMode,
      ].join(':');

      clearTrackingKeys(pendingPlayTrackingKeysRef.current, playTrackingPrefix);
      clearTrackingKeys(syncedPlayTrackingKeysRef.current, playTrackingPrefix);

      if (user) {
        const submissionPrefix = [
          user.id,
          activeUniverseId,
          activeGameId,
          selectedGameMode,
        ].join(':');

        clearTrackingKeys(pendingSubmissionKeysRef.current, submissionPrefix);
        clearTrackingKeys(syncedSubmissionKeysRef.current, submissionPrefix);
      }
    }

    if (isQuoteMode) {
      quoteGame.resetGame();
      return;
    }

    characterGame.resetGame();
  }

  const resolvedGameId = selectedGameId
    ?? (isQuoteMode
      ? quoteGameData?.gameId ?? data?.id ?? null
      : data?.id ?? quoteGameData?.gameId ?? null);
  const heroTitle = selectedGameId === null
    ? isQuoteMode
      ? resolvedGameId !== null
        ? `Daily Quote Game #${resolvedGameId}`
        : 'Daily Quote Game'
      : resolvedGameId !== null
        ? `Daily Character Game #${resolvedGameId}`
        : 'Daily Character Game'
    : isQuoteMode
      ? `Archive Quote Game #${selectedGameId}`
      : `Archive Character Game #${selectedGameId}`;
  const searchPlaceholder = isQuoteMode
    ? 'Guess the speaker'
    : 'Type a name';
  const characterPrimaryActionLabel = shouldOfferQuoteFollowUp ? 'Play Quote' : 'View Leaderboard';
  const characterPrimaryAction = shouldOfferQuoteFollowUp
    ? () => onOpenGame('quote', selectedGameId)
    : () => onNavigate('leaderboard');
  const characterSecondaryActionLabel = shouldOfferQuoteFollowUp ? 'Leaderboard' : undefined;
  const characterSecondaryAction = shouldOfferQuoteFollowUp
    ? () => onNavigate('leaderboard')
    : undefined;
  const quotePrimaryActionLabel = shouldOfferCharacterFollowUp ? 'Play Character Game' : 'View Leaderboard';
  const quotePrimaryAction = shouldOfferCharacterFollowUp
    ? () => onOpenGame('character', selectedGameId)
    : () => onNavigate('leaderboard');
  const quoteSecondaryActionLabel = shouldOfferCharacterFollowUp ? 'Leaderboard' : undefined;
  const quoteSecondaryAction = shouldOfferCharacterFollowUp
    ? () => onNavigate('leaderboard')
    : undefined;

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
              Using hints makes this round unranked. Giving up still counts as a loss.
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

      {currentRound.message && !isComplete && (
        <p className="search-feedback" aria-live="polite">
          {currentRound.message}
        </p>
      )}
    </form>
  );

  return (
    <main className="page centered-page game-page">
      {showLoadingOverlay && (
        <LoadingOverlay
          title="Please wait"
          message="Loading game..."
        />
      )}

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
        <button
          className="game-action-button help-button"
          type="button"
          aria-label="How to play Characterdle"
          title="How to play"
          onClick={() => setIsHelpOpen(true)}
        >
          <img src={questionMarkCircleIcon} alt="" aria-hidden="true" />
        </button>
        <button
          className="game-action-button game-mode-switch-button"
          type="button"
          onClick={() => onOpenGame(isQuoteMode ? 'character' : 'quote', null)}
        >
          {isQuoteMode ? 'Characterdle' : 'Quote'}
        </button>
        {user?.isAdmin && (
          <button className="game-action-button debug-reset-button" type="button" onClick={handleResetGame}>
            Debug Reset
          </button>
        )}
      </div>
      <SiteHelpOverlay isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

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
              answerPortraitUrl={quoteGameData.answerCharacter.portraitUrl ?? null}
              completedGameStats={quoteGame.completedGameStats}
              episodeLabel={formatQuoteEpisodeLabel(quoteGameData.prompt)}
              gameId={quoteGameData.gameId}
              guessCount={displayedQuoteGuessCount}
              hintCount={displayedQuoteHintCount}
              onPrimaryAction={quotePrimaryAction}
              onSecondaryAction={quoteSecondaryAction}
              onViewLeaderboard={() => onNavigate('leaderboard')}
              primaryActionLabel={quotePrimaryActionLabel}
              rows={displayedQuoteRows}
              secondaryActionLabel={quoteSecondaryActionLabel}
              showHintCount={usesRemoteQuoteResult}
              showGuestSignupPrompt={shouldShowGuestSignupPrompt && displayedQuoteStatus === 'won'}
              status={displayedQuoteStatus}
              universeId={quoteGameData.universeId}
              universeName={quoteGameData.universeName}
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
              answerPortraitUrl={data?.answerCharacter.portraitUrl ?? null}
              attributeDefinitions={data?.attributeDefinitions ?? []}
              completedGameStats={characterGame.completedGameStats}
              gameId={data?.id ?? 0}
              gridStyle={tableGridStyle}
              guessCount={displayedCharacterGuessCount}
              hintCount={displayedCharacterHintCount}
              onPrimaryAction={characterPrimaryAction}
              onSecondaryAction={characterSecondaryAction}
              onViewLeaderboard={() => onNavigate('leaderboard')}
              primaryActionLabel={characterPrimaryActionLabel}
              rows={displayedCharacterRows}
              secondaryActionLabel={characterSecondaryActionLabel}
              showHintCount={usesRemoteCharacterResult}
              showGuestSignupPrompt={shouldShowGuestSignupPrompt && displayedCharacterStatus === 'won'}
              status={displayedCharacterStatus}
              universeId={data?.universeId ?? selectedUniverse.id}
              universeName={data?.universeName ?? selectedUniverse.title}
            />
          </div>
        </>
      )}
    </main>
  );
}

function buildSolvedCharacterRow(game: NonNullable<CurrentUniverseGame>): CharacterGameRow {
  return {
    name: game.answerCharacter.displayName || 'ERROR',
    portraitUrl: game.answerCharacter.portraitUrl ?? null,
    cells: game.attributeDefinitions.map((definition) => compareAttributeValue(
      definition,
      game.answerCharacter.attributes[definition.key],
      game.answerCharacter.attributes[definition.key],
    )),
  };
}

function buildSolvedQuoteRow(game: NonNullable<ReturnType<typeof buildQuoteGameData>>): QuoteGameRow {
  return {
    id: game.answerCharacter.id,
    isCorrect: true,
    name: game.answerCharacter.displayName || 'ERROR',
    portraitUrl: game.answerCharacter.portraitUrl ?? null,
  };
}
