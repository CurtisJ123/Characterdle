import { useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import calendarDaysIcon from '../assets/calendar-days-heroicons.svg';
import lockClosedIcon from '../assets/lock-closed-heroicons.svg';
import questionMarkCircleIcon from '../assets/question-mark-circle-heroicons.svg';
import { CharacterGameBoard } from '../components/game/CharacterGameBoard';
import { CharacterHintPanel } from '../components/game/CharacterHintPanel';
import { CharacterPortrait } from '../components/game/CharacterPortrait';
import { QuoteGameBoard } from '../components/game/QuoteGameBoard';
import { QuoteHintPills } from '../components/game/QuoteHintPills';
import { QuotePromptCard } from '../components/game/QuotePromptCard';
import { PremiumArchiveGateOverlay } from '../components/game/PremiumArchiveGateOverlay';
import { SiteHelpOverlay } from '../components/layout/SiteHelpOverlay';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { DiceIcon } from '../components/ui/DiceIcon';
import { useAuth } from '../hooks/useAuth';
import { useCharacterGame } from '../hooks/useCharacterGame';
import { useQuoteGame } from '../hooks/useQuoteGame';
import { useUniverseGameResults } from '../hooks/useUniverseGameResults';
import { useUniverseGame } from '../hooks/useUniverseGame';
import { useUniverse } from '../hooks/useUniverse';
import { getAnonymousParticipantKey } from '../lib/anonymousParticipant';
import { getGameProgressOwnerKey, getRemoteGameOutcome } from '../lib/characterGameProgress';
import { getOrderedCharacterPrefixMatches } from '../lib/characterSearch';
import { buildQuoteGameData } from '../lib/quoteGameData';
import { formatQuoteEpisodeLabel } from '../lib/quotePrompt';
import { compareAttributeValue } from '../lib/universeAttributes';
import { createBillingCheckoutSession } from '../services/billingApi';
import { trackUniverseGamePlay } from '../services/gamePlayTrackingApi';
import { submitUniverseGameResult } from '../services/leaderboardApi';
import { UniverseGameApiError } from '../services/universeGameApi';
import type { GameMode } from '../types/game';
import type { UniverseStreak } from '../types/leaderboard';
import type { PremiumAccess } from '../types/premium';
import type { NavigateToPage } from '../types/routes';
import type { CharacterGameRow, CurrentUniverseGame, CurrentUniverseGameState, QuoteGameRow } from '../types/universeGame';

interface CharacterGamePageProps {
  currentStreak: number;
  gameStateOverride?: CurrentUniverseGameState;
  gameVariant?: 'daily' | 'archive' | 'random';
  onNavigate: NavigateToPage;
  onOpenGame: (gameMode: GameMode, gameId: number | null, universeId?: string) => void;
  onOpenHistory: (gameMode: GameMode, universeId?: string) => void;
  onOpenRandomGame: (gameMode: GameMode, universeId?: string) => void;
  onRefreshRandomGame?: () => void;
  onStreakUpdated: (streak: UniverseStreak) => void;
  premiumAccess: PremiumAccess | null;
  selectedGameId: number | null;
  selectedGameMode: GameMode;
}

const CHARACTER_ATTRIBUTE_REVEAL_DELAY_MS = 95;
const CHARACTER_ATTRIBUTE_NEW_CORRECT_DURATION_MS = 1040;
const RESULT_SCROLL_FALLBACK_DELAY_MS = 120;
const RESULT_SCROLL_ANIMATION_BUFFER_MS = 120;
const GUEST_SIGNUP_POPUP_EXTRA_DELAY_MS = 1800;

function getCharacterResultScrollDelay(attributeCount: number): number {
  const lastRevealDelay = Math.max(attributeCount - 1, 0) * CHARACTER_ATTRIBUTE_REVEAL_DELAY_MS;

  return lastRevealDelay + CHARACTER_ATTRIBUTE_NEW_CORRECT_DURATION_MS + RESULT_SCROLL_ANIMATION_BUFFER_MS;
}

export function CharacterGamePage({
  currentStreak,
  gameStateOverride,
  gameVariant,
  onNavigate,
  onOpenGame,
  onOpenHistory,
  onOpenRandomGame,
  onRefreshRandomGame,
  onStreakUpdated,
  premiumAccess,
  selectedGameId,
  selectedGameMode,
}: CharacterGamePageProps) {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);
  const [showDelayedGuestSignupPrompt, setShowDelayedGuestSignupPrompt] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const resultPanelRef = useRef<HTMLDivElement | null>(null);
  const pendingSubmissionKeysRef = useRef(new Set<string>());
  const syncedSubmissionKeysRef = useRef(new Set<string>());
  const pendingPlayTrackingKeysRef = useRef(new Set<string>());
  const syncedPlayTrackingKeysRef = useRef(new Set<string>());
  const wasCompleteRef = useRef(false);
  const { isAuthenticated, isLoading: isAuthLoading, session, user } = useAuth();
  const requestScope = user?.id ?? 'guest';
  const progressOwnerKey = getGameProgressOwnerKey(user?.id);
  const { selectedUniverse } = useUniverse();
  const resolvedGameVariant = gameVariant ?? (selectedGameId === null ? 'daily' : 'archive');
  const isTemporaryGame = resolvedGameVariant === 'random';
  const fetchedGameState = useUniverseGame(
    selectedUniverse.id,
    selectedGameId,
    session?.access_token ?? null,
    requestScope,
    !gameStateOverride,
  );
  const { data, error, isLoading } = gameStateOverride ?? fetchedGameState;
  const { data: persistedResults } = useUniverseGameResults(
    session?.access_token ?? null,
    selectedUniverse.id,
    progressOwnerKey,
    !isTemporaryGame,
  );
  const characterResult = useMemo(
    () => data
      ? persistedResults.find((result) => result.mode === 'character' && result.gameId === data.id) ?? null
      : null,
    [data, persistedResults],
  );
  const quoteGameData = useMemo(() => buildQuoteGameData(data), [data]);
  const quoteResult = useMemo(
    () => quoteGameData
      ? persistedResults.find((result) => result.mode === 'quote' && result.gameId === quoteGameData.gameId) ?? null
      : null,
    [persistedResults, quoteGameData],
  );
  const characterGame = useCharacterGame(data, characterResult, progressOwnerKey, !isTemporaryGame);
  const quoteGame = useQuoteGame(quoteGameData, quoteResult, progressOwnerKey, !isTemporaryGame);
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
  const remoteCharacterOutcome = characterResult
    ? getRemoteGameOutcome(characterResult.status, characterResult.completedAt)
    : 'pending';
  const remoteQuoteOutcome = quoteResult
    ? getRemoteGameOutcome(quoteResult.status, quoteResult.completedAt)
    : 'pending';
  const usesRemoteCharacterResult = !isTemporaryGame && !isQuoteMode && !!data && characterGame.status === 'playing' && remoteCharacterOutcome !== 'pending';
  const usesRemoteQuoteResult = !isTemporaryGame && isQuoteMode && !!quoteGameData && quoteGame.status === 'playing' && remoteQuoteOutcome !== 'pending';
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
  const shouldWaitForCharacterRevealBeforeScroll = !isQuoteMode
    && displayedCharacterStatus === 'won'
    && displayedCharacterRows.some((row) => row.cells.some((cell) => cell.isRevealing));
  const resultScrollDelay = shouldWaitForCharacterRevealBeforeScroll
    ? getCharacterResultScrollDelay(data?.attributeDefinitions.length ?? 0)
    : RESULT_SCROLL_FALLBACK_DELAY_MS;
  const shouldOfferQuoteFollowUp = displayedCharacterStatus === 'won' && !!quoteGameData && !hasPlayedQuoteGame;
  const shouldOfferCharacterFollowUp = displayedQuoteStatus === 'won' && !!data && !hasWonCharacterGame;
  const shouldShowGuestSignupPrompt = !isTemporaryGame && !isAuthLoading && !isAuthenticated;
  const shouldShowGuestVictorySignup = shouldShowGuestSignupPrompt && (
    isQuoteMode ? displayedQuoteStatus === 'won' : displayedCharacterStatus === 'won'
  );
  const guestSignupPromptDelay = resultScrollDelay + GUEST_SIGNUP_POPUP_EXTRA_DELAY_MS;
  const isPremiumArchiveLocked = !isAuthLoading
    && selectedGameId !== null
    && error instanceof UniverseGameApiError
    && error.status === 403;
  const isRandomGameLocked = premiumAccess?.practiceMode !== true;

  async function handleStartCheckout(plan: 'monthly' | 'yearly') {
    if (!session?.access_token) {
      throw new Error('You must be signed in to subscribe.');
    }

    const redirectUrl = await createBillingCheckoutSession(session.access_token, plan);
    window.location.assign(redirectUrl);
  }

  useEffect(() => {
    if (!shouldShowGuestVictorySignup) {
      setShowDelayedGuestSignupPrompt(false);
      return;
    }

    const overlayTimer = window.setTimeout(() => {
      setShowDelayedGuestSignupPrompt(true);
    }, guestSignupPromptDelay);

    return () => {
      window.clearTimeout(overlayTimer);
    };
  }, [guestSignupPromptDelay, shouldShowGuestVictorySignup]);

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
    }, resultScrollDelay);

    return () => {
      window.clearTimeout(scrollTimer);
    };
  }, [isComplete, resultScrollDelay]);

  useEffect(() => {
    if (
      !isTemporaryGame
      || isGameLoading
      || isComplete
      || isUnavailable
      || !!error
    ) {
      return;
    }

    const focusTimer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [error, isComplete, isGameLoading, isTemporaryGame, isUnavailable, isQuoteMode, data?.id]);

  useEffect(() => {
    if (isTemporaryGame || !data) {
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
    isTemporaryGame,
  ]);

  useEffect(() => {
    if (
      isTemporaryGame
      || !data
      || !session?.access_token
      || !user
      || (
        characterGame.guessCount === 0
        && characterGame.hintCount === 0
        && characterGame.status === 'playing'
      )
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
        const streak = await submitUniverseGameResult(accessToken, {
          gameId: currentGame.id,
          guessCount: characterGame.guessCount,
          guessedCharacterIds: characterGame.guessedCharacterIds,
          hintCount: characterGame.hintCount,
          mode: 'character',
          revealedHintKeys: characterGame.revealedHints.map((hint) => hint.id),
          status: finalizedStatus,
          universeId: currentGame.universeId,
        });
        onStreakUpdated(streak);
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
    characterGame.guessedCharacterIds,
    characterGame.hintCount,
    characterGame.revealedHints,
    characterGame.status,
    data,
    isTemporaryGame,
    onStreakUpdated,
    session?.access_token,
    user,
  ]);

  useEffect(() => {
    if (!quoteGameData || isTemporaryGame) {
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
    isTemporaryGame,
    quoteGame.guessCount,
    quoteGame.hintCount,
    quoteGame.status,
    quoteGameData,
  ]);

  useEffect(() => {
    if (
      isTemporaryGame
      || !quoteGameData
      || !session?.access_token
      || !user
      || (
        quoteGame.guessCount === 0
        && quoteGame.hintCount === 0
        && quoteGame.status === 'playing'
      )
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
        const streak = await submitUniverseGameResult(accessToken, {
          gameId: currentQuoteGame.gameId,
          guessCount: quoteGame.guessCount,
          guessedCharacterIds: quoteGame.guessedCharacterIds,
          hintCount: quoteGame.hintCount,
          mode: 'quote',
          revealedHintKeys: quoteGame.revealedHints.map((hint) => hint.id),
          status: finalizedStatus,
          universeId: currentQuoteGame.universeId,
        });
        onStreakUpdated(streak);
        syncedSubmissionKeysRef.current.add(submissionKey);
      } catch (submissionError) {
        console.error(submissionError);
      } finally {
        pendingSubmissionKeysRef.current.delete(submissionKey);
      }
    }

    void syncResult();
  }, [
    isTemporaryGame,
    quoteGame.guessCount,
    quoteGame.guessedCharacterIds,
    quoteGame.hintCount,
    quoteGame.revealedHints,
    quoteGame.status,
    quoteGameData,
    onStreakUpdated,
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
  const heroTitle = resolvedGameVariant === 'random'
    ? isQuoteMode
      ? 'Random Quote Game'
      : 'Random Character Game'
    : resolvedGameVariant === 'daily'
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
  const heroEyebrow = resolvedGameVariant === 'archive'
    ? `${selectedUniverse.title} archive`
    : `Universe: ${selectedUniverse.title}`;
  const searchPlaceholder = isQuoteMode
    ? 'Guess the speaker'
    : 'Type a name';
  const characterPrimaryActionLabel = resolvedGameVariant === 'random'
    ? 'Another Random Game'
    : shouldOfferQuoteFollowUp ? 'Play Quote' : 'View Leaderboard';
  const characterPrimaryAction = resolvedGameVariant === 'random'
    ? (onRefreshRandomGame ?? (() => onOpenRandomGame('character')))
    : shouldOfferQuoteFollowUp
      ? () => onOpenGame('quote', selectedGameId)
      : () => onNavigate('leaderboard');
  const characterSecondaryActionLabel = resolvedGameVariant === 'random'
    ? 'Random Quote'
    : shouldOfferQuoteFollowUp ? 'Leaderboard' : undefined;
  const characterSecondaryAction = resolvedGameVariant === 'random'
    ? () => onOpenRandomGame('quote')
    : shouldOfferQuoteFollowUp
      ? () => onNavigate('leaderboard')
      : undefined;
  const quotePrimaryActionLabel = resolvedGameVariant === 'random'
    ? 'Another Random Quote'
    : shouldOfferCharacterFollowUp ? 'Play Character Game' : 'View Leaderboard';
  const quotePrimaryAction = resolvedGameVariant === 'random'
    ? (onRefreshRandomGame ?? (() => onOpenRandomGame('quote')))
    : shouldOfferCharacterFollowUp
      ? () => onOpenGame('character', selectedGameId)
      : () => onNavigate('leaderboard');
  const quoteSecondaryActionLabel = resolvedGameVariant === 'random'
    ? 'Random Character'
    : shouldOfferCharacterFollowUp ? 'Leaderboard' : undefined;
  const quoteSecondaryAction = resolvedGameVariant === 'random'
    ? () => onOpenRandomGame('character')
    : shouldOfferCharacterFollowUp
      ? () => onNavigate('leaderboard')
      : undefined;
  const randomAdvanceAction = isQuoteMode ? quotePrimaryAction : characterPrimaryAction;
  const isRandomAdvanceReady = isTemporaryGame
    && isComplete
    && !isHelpOpen
    && !showLoadingOverlay
    && !!randomAdvanceAction;
  const hintTooltipMessage = isTemporaryGame
    ? 'Random games are practice-only and never saved.'
    : 'Using hints makes this round unranked. Giving up still counts as a loss.';

  useEffect(() => {
    if (
      !isTemporaryGame
      || !isComplete
      || !randomAdvanceAction
      || isHelpOpen
      || showLoadingOverlay
    ) {
      return;
    }

    function handleRandomAdvance(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.repeat || event.defaultPrevented) {
        return;
      }

      if (event.target instanceof HTMLElement) {
        const tagName = event.target.tagName;

        if (
          tagName === 'A'
          || tagName === 'BUTTON'
          || tagName === 'INPUT'
          || tagName === 'SELECT'
          || tagName === 'TEXTAREA'
          || event.target.isContentEditable
        ) {
          return;
        }
      }

      event.preventDefault();
      randomAdvanceAction();
    }

    window.addEventListener('keydown', handleRandomAdvance);

    return () => {
      window.removeEventListener('keydown', handleRandomAdvance);
    };
  }, [isComplete, isHelpOpen, isTemporaryGame, randomAdvanceAction, showLoadingOverlay]);

  const searchForm = (
    <form className="search-box" aria-label="Submit a guess" onSubmit={handleSubmit}>
      <span>{isQuoteMode ? 'Quote guess' : 'Character guess'}</span>
      <div className="search-input-stack">
        <div className="search-input-row">
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            autoComplete="off"
            autoFocus={isTemporaryGame}
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
              {hintTooltipMessage}
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
          message={isTemporaryGame ? `Loading random ${selectedGameMode} game...` : 'Loading game...'}
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
          className={`game-action-button random-game-button${isRandomGameLocked ? ' is-locked' : ''}`}
          type="button"
          aria-disabled={isRandomGameLocked}
          aria-describedby={isRandomGameLocked ? 'random-game-premium-tooltip' : undefined}
          aria-label={isRandomGameLocked ? `Requires premium to play a random ${selectedGameMode} game` : `Play a random ${selectedGameMode} game`}
          title={isRandomGameLocked ? undefined : isTemporaryGame ? 'Load another random game' : 'Play a random game'}
          onClick={() => {
            if (isRandomGameLocked) {
              return;
            }

            if (isTemporaryGame && onRefreshRandomGame) {
              onRefreshRandomGame();
              return;
            }

            onOpenRandomGame(selectedGameMode);
          }}
        >
          <span className="random-game-icon-wrap" aria-hidden="true">
            <DiceIcon className="random-game-icon" />
          </span>
          <span className="random-game-label">Random Game</span>
          {isRandomGameLocked && (
            <span className="random-game-lock" aria-hidden="true">
              <img src={lockClosedIcon} alt="" />
            </span>
          )}
          {isRandomGameLocked && (
            <span id="random-game-premium-tooltip" className="random-game-premium-tooltip" role="tooltip">
              Requires premium
            </span>
          )}
        </button>
        <button
          className="game-action-button game-mode-switch-button"
          type="button"
          onClick={() => {
            if (isTemporaryGame) {
              onOpenRandomGame(isQuoteMode ? 'character' : 'quote');
              return;
            }

            onOpenGame(isQuoteMode ? 'character' : 'quote', null);
          }}
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
      {isPremiumArchiveLocked && (
        <PremiumArchiveGateOverlay
          gameLabel={isQuoteMode ? 'Quote' : 'Character'}
          onGoHome={() => onNavigate('launcher')}
          onStartCheckout={isAuthenticated ? handleStartCheckout : undefined}
        />
      )}

      {isPremiumArchiveLocked ? (
        <section className={isQuoteMode ? 'quote-mode-layout' : undefined}>
          <section className={`game-hero${isQuoteMode ? ' is-quote' : ''}`}>
            <p className="eyebrow">{heroEyebrow}</p>
            <h1>{heroTitle}</h1>
          </section>
        </section>
      ) : isQuoteMode && quoteGameData ? (
        <section className="quote-mode-layout">
          <section className="game-hero is-quote">
            <p className="eyebrow">{heroEyebrow}</p>
            <h1>{heroTitle}</h1>
            {error && !isPremiumArchiveLocked && <p className="error-copy">{error.message}</p>}
          </section>

          <QuoteHintPills hints={currentRound.revealedHints} />
          <QuotePromptCard promptText={quoteGameData.prompt.text} />
          {searchForm}

          <div ref={resultPanelRef} className="game-board-shell quote-board-shell">
            <QuoteGameBoard
              answerName={quoteGameData.answerCharacter.displayName}
              answerPortraitUrl={quoteGameData.answerCharacter.portraitUrl ?? null}
              completedGameStats={quoteGame.completedGameStats}
              currentStreak={currentStreak}
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
              showHintCount={isTemporaryGame || usesRemoteQuoteResult}
              showShareButton={!isTemporaryGame}
              highlightPrimaryAction={isRandomAdvanceReady}
              showGuestSignupPrompt={!isTemporaryGame && showDelayedGuestSignupPrompt && displayedQuoteStatus === 'won'}
              status={displayedQuoteStatus}
              universeId={quoteGameData.universeId}
              universeName={quoteGameData.universeName}
            />
          </div>
        </section>
      ) : isQuoteMode ? (
        <section className="quote-mode-layout">
          <section className="game-hero is-quote">
            <p className="eyebrow">{heroEyebrow}</p>
            <h1>{heroTitle}</h1>
            <p className="error-copy">Quote game unavailable.</p>
          </section>
        </section>
      ) : (
        <>
          <section className="game-hero">
            <p className="eyebrow">{heroEyebrow}</p>
            <h1>{heroTitle}</h1>
            {error && !isPremiumArchiveLocked && <p className="error-copy">{error.message}</p>}
          </section>

          {searchForm}

          {currentRound.revealedHints.length > 0 && <CharacterHintPanel hints={currentRound.revealedHints} />}

          <div ref={resultPanelRef} className="game-board-shell">
            <CharacterGameBoard
              answerName={data?.answerCharacter.displayName ?? 'ERROR'}
              answerPortraitUrl={data?.answerCharacter.portraitUrl ?? null}
              attributeDefinitions={data?.attributeDefinitions ?? []}
              completedGameStats={characterGame.completedGameStats}
              currentStreak={currentStreak}
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
              showHintCount={isTemporaryGame || usesRemoteCharacterResult}
              showShareButton={!isTemporaryGame}
              highlightPrimaryAction={isRandomAdvanceReady}
              showGuestSignupPrompt={!isTemporaryGame && showDelayedGuestSignupPrompt && displayedCharacterStatus === 'won'}
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
