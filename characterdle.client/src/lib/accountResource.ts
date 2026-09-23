export class AccountApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AccountSnapshot<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface Entry<T> {
  snapshot: AccountSnapshot<T>;
  refreshAfter: number;
  controller: AbortController;
  pending: Promise<void> | null;
}

// Memory-only UI data, isolated by account and resource scope. The API still authorizes every action.
export class AccountResource<T> {
  private entries = new Map<string, Entry<T>>();
  private listeners = new Set<() => void>();
  readonly empty: AccountSnapshot<T> = { data: null, error: null, isLoading: true };
  readonly signedOut: AccountSnapshot<T> = { data: null, error: null, isLoading: false };

  private readonly now: () => number;
  private readonly ttlMs: number;

  constructor(now = Date.now, ttlMs = 5 * 60_000) {
    this.now = now;
    this.ttlMs = ttlMs;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private notify() { this.listeners.forEach(listener => listener()); }

  peek(userId: string, scope: string): AccountSnapshot<T> {
    return this.entries.get(JSON.stringify([userId, scope]))?.snapshot ?? this.empty;
  }

  clear() {
    const previous = [...this.entries.values()];
    this.entries.clear();
    previous.forEach(entry => entry.controller.abort());
    this.notify();
  }

  load(userId: string, scope: string, loader: (signal: AbortSignal) => Promise<T>, force = false): Promise<void> {
    const key = JSON.stringify([userId, scope]);
    const previous = this.entries.get(key);
    if (!force && previous?.pending) return previous.pending;
    if (!force && previous && this.now() < previous.refreshAfter) return Promise.resolve();
    previous?.controller.abort();

    const controller = new AbortController();
    const entry: Entry<T> = {
      snapshot: { data: previous?.snapshot.data ?? null, error: null, isLoading: !previous?.snapshot.data },
      refreshAfter: 0, controller, pending: null,
    };
    this.entries.set(key, entry);
    const timeout = setTimeout(() => controller.abort(), 15_000);
    entry.pending = Promise.resolve().then(() => loader(controller.signal)).then(data => {
      if (this.entries.get(key) !== entry) return;
      entry.snapshot = { data, error: null, isLoading: false };
      entry.refreshAfter = this.now() + this.ttlMs;
    }).catch((failure: unknown) => {
      if (this.entries.get(key) !== entry) return;
      const error = failure instanceof Error ? failure : new Error('Unable to load account data.');
      const unauthorized = error instanceof AccountApiError && [401, 403].includes(error.status);
      entry.snapshot = { data: unauthorized ? null : entry.snapshot.data, error, isLoading: false };
      entry.refreshAfter = this.now() + 30_000;
    }).finally(() => {
      clearTimeout(timeout);
      if (this.entries.get(key) !== entry) return;
      entry.pending = null;
      this.notify();
    });
    this.notify();
    return entry.pending;
  }
}
