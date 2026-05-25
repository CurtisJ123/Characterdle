export interface AuthActionResult {
  message: string;
  requiresEmailConfirmation: boolean;
}

export interface AuthFormValues {
  displayName: string;
  email: string;
  password: string;
}
