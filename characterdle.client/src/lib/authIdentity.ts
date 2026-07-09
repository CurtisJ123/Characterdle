import type { User } from '@supabase/supabase-js';

function readMetadataValue(user: User, key: string): string | null {
  const value = user.user_metadata?.[key];

  return typeof value === 'string' && value.trim()
    ? value.trim()
    : null;
}

function deriveDisplayNameFromEmail(email: string | undefined): string | null {
  if (!email?.trim()) {
    return null;
  }

  const [localPart] = email.trim().split('@');
  return localPart?.trim() || null;
}

export function readStoredDisplayName(user: User): string | null {
  return readMetadataValue(user, 'display_name');
}

export function deriveDisplayNameFromUser(user: User): string | null {
  return readStoredDisplayName(user)
    ?? readMetadataValue(user, 'full_name')
    ?? readMetadataValue(user, 'name')
    ?? readMetadataValue(user, 'preferred_username')
    ?? readMetadataValue(user, 'user_name')
    ?? readMetadataValue(user, 'nickname')
    ?? deriveDisplayNameFromEmail(user.email);
}
