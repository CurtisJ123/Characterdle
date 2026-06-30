import { buildApiUrl } from '../lib/runtimeConfig';
import type { GameMode } from '../types/game';

export interface TrackUniverseGamePlayPayload {
  gameId: number;
  guessCount: number;
  hintCount: number;
  mode: GameMode;
  participantKey: string;
  status: 'playing' | 'won' | 'lost';
  universeId: string;
}

export async function trackUniverseGamePlay(payload: TrackUniverseGamePlayPayload): Promise<void> {
  const response = await fetch(
    buildApiUrl(`/api/universes/${encodeURIComponent(payload.universeId)}/games/${payload.gameId}/plays`),
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        participantKey: payload.participantKey,
        guessCount: payload.guessCount,
        hintCount: payload.hintCount,
        mode: payload.mode,
        status: payload.status,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Game play tracking failed with ${response.status}.`);
  }
}
