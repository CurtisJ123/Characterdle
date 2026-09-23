import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { GameComments } from '../components/game/GameComments';
import { EpisodeLadderPortrait } from '../components/game/EpisodeLadderPortrait';
import { PremiumArchiveGateOverlay } from '../components/game/PremiumArchiveGateOverlay';
import { DiceIcon } from '../components/ui/DiceIcon';
import { LoadingOverlay } from '../components/ui/LoadingOverlay';
import { RouteLink } from '../components/ui/RouteLink';
import { buildRoutePath } from '../lib/routePaths';
import { useAuth } from '../hooks/useAuth';
import { useEpisodeLadder } from '../hooks/useEpisodeLadder';
import { useEpisodeLadderPreload } from '../hooks/useEpisodeLadderPreload';
import { useLadderDrag } from '../hooks/useLadderDrag';
import calendarDaysIcon from '../assets/calendar-days-heroicons.svg';
import questionMarkCircleIcon from '../assets/question-mark-circle-heroicons.svg';
import lockClosedIcon from '../assets/lock-closed-heroicons.svg';
import { LADDER_BASE_POINTS, LADDER_DAY_MAX_POINTS, LADDER_DIFFICULTIES, moveLadderEvent } from '../lib/episodeLadder';
import { getLadderPreviewOffsets, LADDER_DRAG_SCALE } from '../lib/ladderDropTarget';
import type { BillingCheckoutPlan } from '../types/billing';
import type { GameMode } from '../types/game';
import type { PremiumAccess } from '../types/premium';
import type { NavigateToPage } from '../types/routes';
import type { UniverseStreak } from '../types/leaderboard';
import './CharacterGamePage.css';
import './EpisodeLadderPage.css';

export interface EpisodeLadderPageProps {
  selectedGameId: number | null;
  onNavigate: NavigateToPage;
  onOpenGame: (mode: GameMode, id: number | null, universeId?: string) => void;
  onOpenHistory: (mode: GameMode, universeId?: string) => void;
  onOpenRandomGame: (mode: GameMode, universeId?: string) => void;
  premiumAccess: PremiumAccess | null;
  isPremiumLoading?: boolean;
  onStartCheckout: (plan: BillingCheckoutPlan) => Promise<void>;
  onStreakUpdated?: (streak: UniverseStreak) => void;
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg>;
}

export function EpisodeLadderPage(props: EpisodeLadderPageProps) {
  const { user, session, isLoading: authLoading } = useAuth();
  const [difficulty, setDifficulty] = useState(1);
  const accountLoading = authLoading || props.isPremiumLoading === true;
  const ladder = useEpisodeLadder(props.selectedGameId, user?.id, session?.access_token ?? null, accountLoading, difficulty, props.premiumAccess?.fullArchiveAccess);
  useEpisodeLadderPreload({ ready: !accountLoading && !!ladder.game && !ladder.submitting && !ladder.locked,
    userId: user?.id, token: session?.access_token ?? null, fullArchiveAccess: props.premiumAccess?.fullArchiveAccess,
    gameId: props.selectedGameId, levels: [1, 2, 3, 4, 5].filter(level => level !== difficulty).join(','), warmPage: false });
  const notifyStreak = useEffectEvent((streak: UniverseStreak) => props.onStreakUpdated?.(streak));
  const streak = ladder.game?.streak;
  useEffect(() => { if (streak) notifyStreak(streak); }, [streak]);
  return <EpisodeLadderView key={difficulty} {...props} ladder={ladder} selectedDifficulty={difficulty} onSelectDifficulty={setDifficulty} />;
}

export function EpisodeLadderView({ selectedGameId, onNavigate, onOpenGame, onOpenHistory, onStartCheckout,
  onOpenRandomGame, premiumAccess, ladder, onNextRandomGame, selectedDifficulty, onSelectDifficulty }: EpisodeLadderPageProps & {
    ladder: ReturnType<typeof useEpisodeLadder>; onNextRandomGame?: () => void;
    selectedDifficulty: number; onSelectDifficulty: (difficulty: number) => void;
  }) {
  const { user, session } = useAuth();
  const isRandom = !!onNextRandomGame;
  const gameHref = (mode: GameMode) => buildRoutePath({ page: isRandom ? 'random' : 'game',
    universeId: 'got', gameMode: mode, gameId: isRandom ? null : selectedGameId, authMode: 'login' });
  const { game, order, setOrder, loading, submitting, error } = ladder;
  const isGameLoading = loading && !game && !error && !ladder.locked;
  const gameNumber = game?.gameId ?? selectedGameId;
  const [helpOpen, setHelpOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [revealing, setRevealing] = useState(false);
  const completionRef = useRef<HTMLDivElement>(null);
  const revealTimer = useRef<number | undefined>(undefined);
  const isComplete = game?.status === 'won' || game?.status === 'lost';
  const isDayComplete = LADDER_DIFFICULTIES.every((_, index) =>
    ladder.difficulties[index] === 'won' || ladder.difficulties[index] === 'lost');
  const difficultyPoints = game?.difficultyPoints;
  const dayPoints = difficultyPoints?.length === LADDER_DIFFICULTIES.length
    ? difficultyPoints.reduce((total, points) => total + points, 0) : null;
  const lastAttempt = game?.attempts.at(-1);
  const freeSlots = order.map((_, index) => index).filter(index => !game?.lockedPositions.includes(index));
  const inputDisabled = submitting || revealing || isComplete;
  const nextReady = isRandom && isComplete && !revealing && !loading && !submitting && !ladder.locked && !helpOpen;
  const nextButton = useRef<HTMLButtonElement>(null);
  const advance = useEffectEvent(() => onNextRandomGame?.());
  const drag = useLadderDrag(order, game?.lockedPositions ?? [], !!inputDisabled, move);
  const previewOffsets = getLadderPreviewOffsets(order.length, drag.visual?.from ?? -1,
    game?.lockedPositions ?? [], drag.visual?.target ?? null);

  useEffect(() => () => window.clearTimeout(revealTimer.current), []);
  useEffect(() => {
    if (!nextReady) return;
    nextButton.current?.focus({ preventScroll: true });
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.repeat || event.isComposing || event.defaultPrevented
        || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (target?.closest('button, a, summary') && target !== nextButton.current) return;
      if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return;
      event.preventDefault();
      advance();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextReady]);
  useEffect(() => {
    if (!isRandom || !game || game.attempts.length) return;
    const target = drag.cards.current.get(game.initialOrder[0]);
    target?.focus({ preventScroll: true });
    target?.closest('main')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [isRandom, game, drag.cards]);

  function move(from: number, to: number, mode: 'swap' | 'insert' = 'swap') {
    if (!game || inputDisabled) return;
    const next = moveLadderEvent(order, from, to, game.lockedPositions, mode);
    if (next === order) return;
    drag.prepareMove(next, drag.visual ? order[from] : undefined);
    setOrder(next);
    setAnnouncement(mode === 'swap' ? `Swapped events in positions ${from + 1} and ${to + 1}.`
      : `Moved event from position ${from + 1} to ${to + 1}. Locked events stayed in place.`);
    requestAnimationFrame(() => {
      drag.cards.current.get(order[from])?.focus({ preventScroll: true });
    });
  }

  async function submit() {
    if (inputDisabled || drag.visual || !game) return;
    const saved = await ladder.submit();
    // The hook owns saving; this delay is presentation only and never changes an attempt.
    if (saved) {
      setRevealing(true);
      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 950;
      revealTimer.current = window.setTimeout(() => {
        setRevealing(false);
        completionRef.current?.scrollIntoView({ behavior: duration ? 'smooth' : 'auto', block: 'nearest' });
      }, duration);
    }
  }

  return (
    <main className="page game-page episode-ladder-page">
      {isGameLoading && <LoadingOverlay title="Please wait"
        message={isRandom ? 'Loading random Episode Ladder game...' : 'Loading game...'} />}
      <nav className="game-top-actions" aria-label="Game modes">
        <RouteLink className="game-action-button history-button" href="/got/archive/episode_ladder" aria-label="View previous Episode Ladder games" title="View previous games" onNavigate={() => onOpenHistory('episode_ladder', 'got')}><img src={calendarDaysIcon} alt="" /></RouteLink>
        <button className="game-action-button help-button" type="button" aria-label="How to play Episode Ladder" title="How to play" onClick={() => setHelpOpen(true)}><img src={questionMarkCircleIcon} alt="" /></button>
        {isRandom ? <RouteLink className="game-action-button current-game-button" href="/got/game/episode_ladder" onNavigate={() => onOpenGame('episode_ladder', null, 'got')}>
          <span className="current-game-icon-wrap" aria-hidden="true"><svg className="current-game-icon" viewBox="0 0 24 24" fill="none"><path d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <span className="current-game-label">Current Game</span>
        </RouteLink> :
          <RouteLink className={`game-action-button random-game-button${!premiumAccess?.practiceMode ? ' is-locked' : ''}`} href="/got/random/episode_ladder"
            title={premiumAccess?.practiceMode ? 'Play a randomly generated game.' : undefined}
            aria-describedby={!premiumAccess?.practiceMode ? 'random-game-premium-tooltip' : undefined}
            onNavigate={() => onOpenRandomGame('episode_ladder', 'got')}>
            <span className="random-game-icon-wrap" aria-hidden="true"><DiceIcon className="random-game-icon" /></span>
            <span className="random-game-label">Random Game</span>
            {!premiumAccess?.practiceMode && <>
              <span className="random-game-lock" aria-hidden="true"><img src={lockClosedIcon} alt="" /></span>
              <span id="random-game-premium-tooltip" className="random-game-premium-tooltip" role="tooltip">
                <strong>Requires Premium</strong><span>Play a randomly generated game.</span>
              </span>
            </>}
          </RouteLink>}
        <span className="game-mode-links">
          <RouteLink className="game-action-button game-mode-switch-button" href={gameHref('character')} onNavigate={() => isRandom ? onOpenRandomGame('character', 'got') : onOpenGame('character', selectedGameId, 'got')}>Characterdle</RouteLink>
          <RouteLink className="game-action-button game-mode-switch-button" href={gameHref('quote')} onNavigate={() => isRandom ? onOpenRandomGame('quote', 'got') : onOpenGame('quote', selectedGameId, 'got')}>Quote</RouteLink>
        </span>
      </nav>
      <header className="game-hero ladder-hero">
        <p className="eyebrow">Game of Thrones</p>
        <h1>{isRandom ? 'Random Episode Ladder' : `Episode Ladder${gameNumber !== null ? ` #${gameNumber}` : ''}`}</h1>
        <div className="ladder-difficulties" role="group" aria-label="Difficulty">
          {LADDER_DIFFICULTIES.map((label, index) => {
            const status = ladder.difficulties[index];
            const completed = status === 'won' || status === 'lost';
            return <button key={label} className={`ladder-level level-${index + 1}${selectedDifficulty === index + 1 ? ' is-selected' : ''}${completed ? ' is-complete' : ''}`}
              type="button" aria-pressed={selectedDifficulty === index + 1} aria-label={`${label}${completed ? ', completed' : ''}`}
              disabled={submitting || revealing || !!drag.visual} onClick={() => onSelectDifficulty(index + 1)}>{label}</button>;
          })}
        </div>
      </header>
      {helpOpen && <dialog className="glass-card ladder-help-dialog" aria-label="How to play Episode Ladder" onCancel={() => setHelpOpen(false)}
        ref={element => { if (element && !element.open) element.showModal(); }}>
        <button className="secondary-button" type="button" onClick={() => setHelpOpen(false)}>Close</button>
        <p className="card-kicker">How to play</p><h2>Episode Ladder</h2>
        <p>Order five events by episode, earliest to latest. Each event comes from a different episode. You have four attempts per difficulty.</p>
        <ul><li>Drop onto the middle of a card to swap positions. The highlighted card nudges toward your starting position. Drop near a card's top or bottom edge, or between cards, to insert instead; a small gap opens where it will go. Dropping above or below the board moves the event to the first or last available position. Only unlocked events shift.</li>
          <li>On touch screens, drag using the grip. With a keyboard, focus a card and use Up/Down to swap with the next unlocked card. Press Escape to cancel a drag.</li>
          <li>Green events are correct and locked. Yellow means one position away. Grey means farther away.</li>
          <li>Flashbacks follow episode and on-screen order, not story chronology.</li>
          <li>Start with Easy and work up to Impossible. Impossible uses five consecutive episodes; easier difficulties spread events farther apart. Completed difficulties turn grey.</li>
          <li>Daily and archive difficulties cannot be replayed after a win or loss. Random games are separate practice rounds.</li>
          <li>Signed-in players can read and post comments after completing all five difficulties for that day, win or lose.</li></ul>
      </dialog>}
      {ladder.locked && <PremiumArchiveGateOverlay gameLabel="Episode Ladder" onGoHome={() => onNavigate('launcher')}
        {...(isRandom ? { featureLabel: 'Premium random game', headline: 'Subscribe to premium to play random games.',
          message: 'Play unlimited Episode Ladder practice rounds without changing your daily progress.' } : {})}
        onStartCheckout={user ? onStartCheckout : undefined} />}
      {error && !ladder.locked && <div className="ladder-message" role="alert">
        <p>{error}</p>{(!game || isRandom) && <button className="secondary-button" onClick={ladder.retry}>{isRandom ? 'New Random Game' : 'Try again'}</button>}
      </div>}
      {game && !loading && <>
        <section className="ladder-board" aria-label="Event timeline">
          {!isRandom && dayPoints !== null && <dl className="ladder-points" aria-label="Episode Ladder points" aria-live="polite" aria-atomic="true">
            <div><dt>Day total</dt><dd>{dayPoints}<span> / {LADDER_DAY_MAX_POINTS} pts</span></dd></div>
            <div><dt>{LADDER_DIFFICULTIES[game.difficulty - 1]}</dt>
              <dd>{difficultyPoints![game.difficulty - 1]}<span> / {LADDER_BASE_POINTS[game.difficulty - 1]} pts</span></dd></div>
          </dl>}
          <div className="ladder-board-heading"><span>Earliest</span><span>{game.attempts.length} / {game.maxAttempts} attempts</span></div>
          <div className="ladder-events-wrap">
          <ol className={`ladder-events${revealing ? ' is-revealing' : ''}`}>
            {order.map((id, position) => {
              const event = game.events.find(item => item.id === id)!;
              const locked = game.lockedPositions.includes(position);
              const tone = locked ? 'correct' : lastAttempt?.order[position] === id ? lastAttempt.feedback[position] : 'ungraded';
              const slot = freeSlots.indexOf(position);
              const previous = freeSlots[slot - 1];
              const next = freeSlots[slot + 1];
              const feedback = tone === 'correct' ? 'Correct, locked' : tone === 'adjacent' ? 'One position away' : tone === 'incorrect' ? 'More than one position away' : 'Not checked';
              const episodeLabel = locked && event.episode
                ? `Season ${event.episode.seasonNumber}, Episode ${event.episode.episodeNumber}${event.episode.title ? `: ${event.episode.title}` : ''}` : null;
              return <li key={id} className={`ladder-event is-${tone}${drag.visual?.from === position ? ' is-dragging' : ''}${drag.visual?.target?.mode === 'swap' && drag.visual.target.to === position ? ' is-drop-target' : ''}${drag.visual?.target?.mode === 'insert' && previewOffsets[position] ? ' is-insert-neighbor' : ''}`}
                tabIndex={locked || inputDisabled ? -1 : 0} aria-label={`Event ${position + 1}: ${event.description}. ${feedback}${episodeLabel ? `. ${episodeLabel}` : ''}`}
                ref={element => { if (element) drag.cards.current.set(id, element); else drag.cards.current.delete(id); }}
                style={drag.visual?.from === position ? { transform: `translateY(${drag.visual.offset}px) scale(${LADDER_DRAG_SCALE})` }
                  : previewOffsets[position] ? { translate: `0 ${previewOffsets[position]}px` } : undefined}
                onDragStart={event => event.preventDefault()}
                onPointerDown={event => drag.start(event, position)} onPointerMove={drag.pointerMove} onPointerUp={drag.end}
                onPointerCancel={drag.cancel} onLostPointerCapture={drag.cancel}
                onKeyDown={event => {
                  if (event.key === 'Escape') { drag.cancel(); return; }
                  if (drag.visual) { if (event.key.startsWith('Arrow')) event.preventDefault(); return; }
                  if (event.key === 'ArrowDown' && next !== undefined) { event.preventDefault(); move(position, next); }
                  if (event.key === 'ArrowUp' && previous !== undefined) { event.preventDefault(); move(position, previous); }
                }}>
                <span className="ladder-position" aria-label={`Position ${position + 1}`}>{position + 1}</span>
                <EpisodeLadderPortrait event={event} />
                <div className="ladder-event-copy"><p>{event.description}</p>{episodeLabel && <span className="ladder-feedback">{episodeLabel}</span>}</div>
                {locked ? <span className="ladder-lock" aria-label="Correct event locked in place"><LockIcon /></span> : !isComplete &&
                  <span className="ladder-grip" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 5h0m6 0h0M9 12h0m6 0h0M9 19h0m6 0h0" /></svg></span>}
              </li>;
            })}
          </ol>
          </div>
          <div className="ladder-board-heading"><span>Latest</span><span>{game.lockedPositions.length} / 5 correct</span></div>
          <p className="ladder-announcement" role="status">{announcement}</p>
          <p className="ladder-announcement" role="status">{game.status === 'won' ? 'Timeline complete.' : game.status === 'lost' ? 'No attempts left. This difficulty is complete.' : `${game.attempts.length} attempts used. ${game.lockedPositions.length} events correct.`}</p>
          {!isComplete && <button className="primary-button ladder-submit" type="button" disabled={inputDisabled || !!drag.visual} onClick={() => { void submit(); }}>
            {submitting ? 'Checking...' : revealing ? 'Revealing...' : 'Check order'}
          </button>}
          <div className="ladder-legend" aria-label="Feedback key">
            <span><i className="is-correct" />Correct</span><span><i className="is-adjacent" />One away</span>
          </div>
        </section>
        {game.attempts.length > 0 && <section className="ladder-attempts" aria-label="Previous attempts">
          {game.attempts.map((attempt, index) => <div className="ladder-attempt" key={index} aria-label={`Attempt ${index + 1}: ${attempt.feedback.join(', ')}`}>
            <span>{index + 1}</span>{attempt.feedback.map((tone, slot) => <i key={slot} className={`is-${tone}`} aria-hidden="true" />)}
          </div>)}
        </section>}
        {isComplete && (selectedDifficulty < 5 || isRandom) && <div ref={completionRef} className="ladder-completion-actions">
            {selectedDifficulty < 5 && <button className="primary-button" type="button" disabled={revealing} onClick={() => onSelectDifficulty(selectedDifficulty + 1)}>Play {LADDER_DIFFICULTIES[selectedDifficulty]}</button>}
            {isRandom && <button ref={nextButton} className={`primary-button ladder-next${nextReady ? ' is-ready' : ''}`} type="button" disabled={!nextReady} onClick={onNextRandomGame}>Next Random Game</button>}
        </div>}
        {!isRandom && isComplete && isDayComplete && !revealing && !ladder.locked && user && session?.access_token &&
          <GameComments key={`${user.id}:${game.gameId}`} accessToken={session.access_token} userId={user.id} universeId="got" gameId={game.gameId} mode="episode_ladder" />}
      </>}
    </main>
  );
}
