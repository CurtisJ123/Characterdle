export const MIN_PASSWORD_LENGTH = 8;

export function meetsMinimumPasswordLength(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}
