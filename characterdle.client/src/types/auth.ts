export interface AuthActionResult {
  message: string;
  requiresEmailConfirmation: boolean;
}

export interface AuthFormValues {
  displayName: string;
  email: string;
  password: string;
}

export interface AccountSettingsValues {
  avatarUrl: string | null;
  autoUseStreakSavers: boolean;
  displayName: string;
}

export interface AccountDeletionStatus {
  canDelete: boolean;
  hasActiveSubscription: boolean;
  message: string;
}

export interface PasswordResetRequestValues {
  email: string;
}

export interface ResendConfirmationRequestValues {
  email: string;
}

export interface PasswordUpdateValues {
  password: string;
}

export type OAuthProvider = 'google';
