import type { AdminPlayerProfile } from './admin';
export interface AdminPageResult<T> { items: T[]; page: number; hasNextPage: boolean }
export interface ModerationGuestLink { guestId: string; linkedAt: string; linkedBy: string }
export interface PlayerModerationState {
  state: 'normal' | 'shadow_banned'; isRestricted: boolean; reason: string; expiresAt: string | null;
  updatedAt: string | null; updatedBy: string | null; revision: number; guestLinks: ModerationGuestLink[];
}
export interface AdminPlayerDetails {
  profile: AdminPlayerProfile; moderation: PlayerModerationState; isAdmin: boolean; canRestrict: boolean;
  billing: { status: string | null; currentPeriodStart: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; cancelAt: string | null };
  ladderFirstAttemptWinRate: number;
}
export interface GuestEvidence {
  guestId: string; recordedGames: number; completedGames: number; lastPlayedAt: string | null;
  linkedUserId: string | null; linkedDisplayName: string | null; linkedRevision: number | null;
}
export interface ModerationAuditEntry {
  id: number; actorId: string; createdAt: string; action: string; reason: string;
  previousState: PlayerModerationState; newState: PlayerModerationState; requestId: string;
}
export interface AdminGameHistory {
  universeId: string; gameId: number; mode: string; status: string; guessCount: number; hintCount: number;
  completedAt: string | null; difficulty: number | null; points: number | null; dailyPoints: number | null; attempts: number[][] | null;
}
export interface AdminActivity {
  universeId: string; gameId: number; mode: string; status: string | null; guessCount: number;
  updatedAt: string; completedAt: string | null; guestKey: string | null; guestStatus: string | null;
  guestGuessCount: number | null; guestCompletedAt: string | null; secondsBefore: number | null;
}
export interface AdminActivityPage {
  history: AdminPageResult<AdminActivity>;
  repeatedGuests: { guestKey: string; matches: number; lastMatchAt: string }[];
}
export interface SavePlayerModeration {
  state: PlayerModerationState['state']; reason: string; expiresAt: string | null; expectedRevision: number;
  requestId: string; guestIds: string[]; confirmed: boolean;
  reassignments: { guestId: string; fromUserId: string; expectedRevision: number }[];
}
