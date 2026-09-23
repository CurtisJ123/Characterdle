import { buildApiUrl } from '../lib/runtimeConfig';
import type { GameMode } from '../types/game';
import type { GameComment, GameCommentsPage } from '../types/gameComments';

export interface GameCommentsScope {
  universeId: string;
  gameId: number;
  mode: GameMode;
}

export class GameCommentsApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function commentsUrl(scope: GameCommentsScope): string {
  return buildApiUrl(`/api/universes/${encodeURIComponent(scope.universeId)}/games/${scope.gameId}/${scope.mode}/comments/`);
}

async function requireSuccess(response: Response, mode: GameMode): Promise<void> {
  if (response.ok) {
    return;
  }

  const message = response.status === 403
    ? mode === 'episode_ladder'
      ? 'Comments unlock after all five difficulties for this day are completed and saved.'
      : 'Comments unlock once your completed game is saved. Please try again.'
    : response.status === 401
      ? 'Please sign in again to view comments.'
      : response.status === 400
        ? 'Enter a comment between 1 and 300 characters without control characters.'
        : 'Comments are temporarily unavailable. Please try again.';
  throw new GameCommentsApiError(response.status, message);
}

export async function getGameComments(
  accessToken: string, scope: GameCommentsScope, page: number, signal: AbortSignal,
): Promise<GameCommentsPage> {
  const response = await fetch(`${commentsUrl(scope)}?page=${page}`, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
    signal,
  });
  await requireSuccess(response, scope.mode);
  return await response.json() as GameCommentsPage;
}

export async function postGameComment(
  accessToken: string, scope: GameCommentsScope, body: string, signal: AbortSignal,
): Promise<GameComment> {
  const response = await fetch(commentsUrl(scope), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ body }),
    signal,
  });
  await requireSuccess(response, scope.mode);
  return await response.json() as GameComment;
}
