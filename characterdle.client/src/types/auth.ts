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
  displayName: string;
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
