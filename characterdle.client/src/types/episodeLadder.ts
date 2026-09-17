export type LadderTone = 'correct' | 'adjacent' | 'incorrect';

export interface LadderAttempt {
  order: number[];
  feedback: LadderTone[];
}

export interface EpisodeLadderGame {
  gameId: number;
  dateTime: string;
  difficulty: number;
  maxAttempts: number;
  events: { id: number; description: string; portraitUrl: string | null; characterName: string | null }[];
  initialOrder: number[];
  attempts: LadderAttempt[];
  lockedPositions: number[];
  status: 'playing' | 'won' | 'lost';
  difficulties?: string[] | null;
  solution: { id: number; seasonNumber: number; episodeNumber: number; minute: number; second: number }[] | null;
}

export interface RandomLadderRound {
  game: EpisodeLadderGame;
  roundToken: string;
}
