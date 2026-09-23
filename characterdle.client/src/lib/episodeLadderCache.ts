import type { EpisodeLadderGame } from '../types/episodeLadder';

export interface LadderSnapshot {
  game: EpisodeLadderGame;
  order: number[];
  receivedAt: number;
  day: string;
}

interface Entry {
  snapshot?: LadderSnapshot;
  promise?: Promise<LadderSnapshot>;
  controller?: AbortController;
  background: boolean;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
});
export const ladderDay = (now = Date.now()) => dayFormatter.format(now);
export const ladderScope = (userId?: string, fullArchiveAccess = false) => `${userId ? `user:${userId}` : 'guest'}:${fullArchiveAccess ? 'full' : 'limited'}`;
export const LADDER_CACHE_TTL = 5 * 60_000;

// Memory only: personalized responses never enter a shared HTTP cache or persistent storage.
export class EpisodeLadderCache {
  private entries = new Map<string, Entry>();
  private listeners = new Set<() => void>();
  private now: () => number;

  constructor(now: () => number = Date.now) { this.now = now; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { for (const listener of this.listeners) listener(); }
  private key(scope: string, id: number | null, level: number) { return `${scope}|${id ?? 'current'}|${level}`; }

  peek(scope: string, id: number | null, level: number): LadderSnapshot | undefined {
    const snapshot = this.entries.get(this.key(scope, id, level))?.snapshot;
    return snapshot?.day === ladderDay(this.now()) ? snapshot : undefined;
  }

  clear() {
    for (const entry of this.entries.values()) entry.controller?.abort();
    this.entries.clear(); this.emit();
  }

  invalidate(scope: string, id: number | null, level: number) {
    const key = this.key(scope, id, level);
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.controller?.abort();
    for (const [alias, value] of this.entries) if (value === entry) this.entries.delete(alias);
    this.emit();
  }

  cancelBackground(except?: Entry) {
    for (const entry of new Set(this.entries.values())) {
      if (entry !== except && entry.background && entry.promise) entry.controller?.abort();
    }
  }

  cancelReads(scope: string, id: number, level: number) {
    for (const key of [this.key(scope, id, level), this.key(scope, null, level)]) {
      const entry = this.entries.get(key);
      if (entry && (!entry.snapshot || entry.snapshot.game.gameId === id)) entry.controller?.abort();
    }
  }

  private trim() {
    while (this.entries.size > 80) {
      const key = this.entries.keys().next().value!;
      this.entries.get(key)?.controller?.abort();
      this.entries.delete(key);
    }
  }

  set(scope: string, game: EpisodeLadderGame): LadderSnapshot {
    const key = this.key(scope, game.gameId, game.difficulty);
    const previous = this.peek(scope, game.gameId, game.difficulty);
    const sameAttempts = previous && JSON.stringify(previous.game.attempts) === JSON.stringify(game.attempts)
      && JSON.stringify(previous.game.initialOrder) === JSON.stringify(game.initialOrder);
    const snapshot: LadderSnapshot = { game: { ...game, streak: null },
      order: sameAttempts ? previous.order : [...(game.attempts.at(-1)?.order ?? game.initialOrder)],
      receivedAt: this.now(), day: ladderDay(this.now()) };
    const entry: Entry = { snapshot, background: false };
    const currentKey = this.key(scope, null, game.difficulty);
    const old = this.entries.get(key);
    old?.controller?.abort();
    if (this.entries.get(currentKey)?.snapshot?.game.gameId === game.gameId || this.entries.get(currentKey) === old && old) {
      this.entries.set(currentKey, entry);
    }
    this.entries.set(key, entry);
    // A new difficulty result also refreshes the selector on previously cached boards.
    for (const value of new Set(this.entries.values())) {
      if (value === entry || value.snapshot?.game.gameId !== game.gameId) continue;
      if (![...this.entries].some(([alias, candidate]) => candidate === value && alias.startsWith(`${scope}|`))) continue;
      const states = [...(game.difficulties ?? value.snapshot.game.difficulties ?? Array(5).fill('pending'))];
      states[game.difficulty - 1] = game.status;
      value.snapshot = { ...value.snapshot, game: { ...value.snapshot.game, difficulties: states } };
    }
    this.trim(); this.emit();
    return snapshot;
  }

  setOrder(scope: string, id: number, level: number, order: number[]) {
    const entry = this.entries.get(this.key(scope, id, level));
    if (!entry?.snapshot) return;
    entry.snapshot = { ...entry.snapshot, order: [...order] }; this.emit();
  }

  load(scope: string, id: number | null, level: number, fetcher: (signal: AbortSignal) => Promise<EpisodeLadderGame>,
    { background = false, force = false } = {}): Promise<LadderSnapshot> {
    const key = this.key(scope, id, level);
    let entry = this.entries.get(key);
    if (!background) {
      if (entry) entry.background = false;
      this.cancelBackground(entry);
    }
    const cached = this.peek(scope, id, level);
    if (!force && cached && this.now() - cached.receivedAt < LADDER_CACHE_TTL) return Promise.resolve(cached);
    if (entry?.promise && !entry.controller?.signal.aborted) return entry.promise;
    entry = { snapshot: cached, background, controller: new AbortController() };
    this.entries.set(key, entry);
    const ownedEntry = entry;
    const signal = entry.controller!.signal;
    const requestedDay = ladderDay(this.now());
    entry.promise = fetcher(signal).then(async game => {
      if (signal.aborted || this.entries.get(key) !== ownedEntry) throw new DOMException('Superseded load', 'AbortError');
      // A request spanning midnight must not label yesterday's current game as today's cache.
      if (id === null && requestedDay !== ladderDay(this.now())) game = await fetcher(signal);
      if (signal.aborted || this.entries.get(key) !== ownedEntry) throw new DOMException('Superseded load', 'AbortError');
      // Remove the pending request before publishing, so set() cannot abort its own response.
      ownedEntry.promise = undefined; ownedEntry.controller = undefined;
      const snapshot = this.set(scope, game);
      if (id === null) this.entries.set(key, this.entries.get(this.key(scope, game.gameId, level))!);
      this.emit();
      return snapshot;
    }).catch(error => {
      if (this.entries.get(key) === ownedEntry) {
        ownedEntry.promise = undefined; ownedEntry.controller = undefined;
        if (!ownedEntry.snapshot) this.entries.delete(key);
      }
      throw error;
    });
    this.trim();
    return entry.promise;
  }
}
