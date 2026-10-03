export interface LeaderboardSnapshot<T> { data: T | null; error: Error | null; isLoading: boolean }
interface Entry<T> {
  snapshot: LeaderboardSnapshot<T>; expires: number; pending: boolean;
  controller: AbortController; request: Promise<T>;
}

// Public-display data only. Each caller includes authenticated/guest identity in its key.
export class LeaderboardResource<T> {
  readonly empty: LeaderboardSnapshot<T> = { data: null, error: null, isLoading: true };
  private entries = new Map<string, Entry<T>>();
  private listeners = new Set<() => void>();
  private now: () => number;
  constructor(now = Date.now) { this.now = now; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private notify() { this.listeners.forEach(listener => listener()); }
  peek(key: string) { return this.entries.get(key)?.snapshot ?? this.empty; }
  clear(matches: (key: string) => boolean = () => true) {
    for (const [key, entry] of this.entries) if (matches(key)) { this.entries.delete(key); entry.controller.abort(); }
    this.notify();
  }
  load(key: string, loader: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const previous = this.entries.get(key);
    if (previous && (previous.pending || (!previous.snapshot.error && this.now() < previous.expires))) return previous.request;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const entry: Entry<T> = {
      controller, pending: true, expires: 0,
      snapshot: { data: previous?.snapshot.data ?? null, error: null, isLoading: !previous?.snapshot.data },
      request: loader(controller.signal).then(data => {
        if (this.entries.get(key) === entry) { entry.snapshot = { data, error: null, isLoading: false }; entry.expires = this.now() + 45_000; }
        return data;
      }).catch((failure: unknown) => {
        if (this.entries.get(key) === entry) {
          entry.snapshot = { data: null, error: failure instanceof Error ? failure : new Error('Leaderboard unavailable.'), isLoading: false };
          entry.expires = this.now() + 15_000;
        }
        throw failure;
      }).finally(() => { clearTimeout(timeout); if (this.entries.get(key) === entry) { entry.pending = false; this.notify(); } }),
    };
    this.entries.set(key, entry); this.notify();
    return entry.request;
  }
}
