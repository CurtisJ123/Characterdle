const PARTICIPANT_STORAGE_KEY = 'characterdle-anonymous-participant-id';

function generateParticipantKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `guest-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function getAnonymousParticipantKey(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  try {
    const storedValue = window.localStorage.getItem(PARTICIPANT_STORAGE_KEY)?.trim();

    if (storedValue) {
      return storedValue;
    }

    const nextValue = generateParticipantKey();
    window.localStorage.setItem(PARTICIPANT_STORAGE_KEY, nextValue);
    return nextValue;
  } catch {
    return generateParticipantKey();
  }
}
