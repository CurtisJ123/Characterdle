import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session, User, UserAttributes } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { deriveDisplayNameFromUser, readStoredDisplayName } from '../lib/authIdentity';
import {
  buildOAuthRedirectUrl,
  clearPendingOAuthRedirect,
  hasPendingOAuthRedirectForCurrentPath,
  markPendingOAuthRedirect,
} from '../lib/oauthState';
import type {
  AccountDeletionStatus,
  AccountSettingsValues,
  AuthActionResult,
  AuthFormValues,
  OAuthProvider,
  PasswordResetRequestValues,
  PasswordUpdateValues,
  ResendConfirmationRequestValues,
} from '../types/auth';
import { MIN_PASSWORD_LENGTH, meetsMinimumPasswordLength } from '../lib/authValidation';
import type { UserProfile } from '../types/user';
import {
  deleteProfileAccount,
  getAccountDeletionStatus as getAccountDeletionStatusRequest,
  updateProfileSettings,
} from '../services/profileApi';

interface AuthContextValue {
  authError: Error | null;
  completePasswordReset: (values: PasswordUpdateValues) => Promise<AuthActionResult>;
  deleteAccount: () => Promise<AuthActionResult>;
  getAccountDeletionStatus: () => Promise<AccountDeletionStatus>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isPasswordRecovery: boolean;
  refreshUser: () => Promise<void>;
  requestPasswordReset: (values: PasswordResetRequestValues) => Promise<AuthActionResult>;
  resendConfirmationEmail: (values: ResendConfirmationRequestValues) => Promise<AuthActionResult>;
  session: Session | null;
  signIn: (values: AuthFormValues) => Promise<AuthActionResult>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (values: AuthFormValues) => Promise<AuthActionResult>;
  updateAccount: (values: AccountSettingsValues) => Promise<AuthActionResult>;
  user: UserProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAdminFlag(user: User): boolean {
  const appRole = typeof user.app_metadata?.role === 'string'
    ? user.app_metadata.role.trim().toLowerCase()
    : null;
  const appRoles = Array.isArray(user.app_metadata?.roles)
    ? user.app_metadata.roles
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim().toLowerCase())
    : [];
  const metadataRole = typeof user.user_metadata?.role === 'string'
    ? user.user_metadata.role.trim().toLowerCase()
    : null;

  return appRole === 'admin'
    || metadataRole === 'admin'
    || appRoles.includes('admin')
    || user.app_metadata?.is_admin === true
    || user.user_metadata?.is_admin === true
    || user.user_metadata?.admin === true;
}

function buildUserProfile(user: User): UserProfile {
  const displayName = deriveDisplayNameFromUser(user) ?? 'ERROR';

  return {
    avatarUrl: typeof user.user_metadata.avatar_url === 'string' && user.user_metadata.avatar_url.trim()
      ? user.user_metadata.avatar_url.trim()
      : null,
    createdAt: typeof user.created_at === 'string' && user.created_at.trim()
      ? user.created_at
      : null,
    displayName,
    email: user.email?.trim() || 'ERROR',
    id: user.id,
    isAdmin: readAdminFlag(user),
  };
}

function normalizeError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function isResetPasswordPath(pathname: string): boolean {
  return pathname === '/reset-password' || pathname.endsWith('/reset-password');
}

function isAuthPath(pathname: string): boolean {
  return pathname === '/login'
    || pathname === '/signup'
    || pathname.endsWith('/login')
    || pathname.endsWith('/signup');
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authError, setAuthError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  function applySession(nextSession: Session | null) {
    setSession(nextSession);
    setUser(nextSession ? buildUserProfile(nextSession.user) : null);
  }

  async function normalizeSessionUser(nextSession: Session | null): Promise<Session | null> {
    if (!nextSession) {
      return null;
    }

    const displayName = deriveDisplayNameFromUser(nextSession.user);

    if (!displayName || readStoredDisplayName(nextSession.user)) {
      return nextSession;
    }

    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName,
        },
      });

      if (error) {
        console.warn('Unable to persist the OAuth display name.', error);
        return nextSession;
      }

      return data.user
        ? {
          ...nextSession,
          user: data.user,
        }
        : nextSession;
    } catch (error) {
      console.warn('Unable to persist the OAuth display name.', error);
      return nextSession;
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      if (error) {
        setAuthError(error);
      }

      const normalizedSession = await normalizeSessionUser(data.session);

      if (!isMounted) {
        return;
      }

      if (isResetPasswordPath(window.location.pathname) && normalizedSession) {
        setIsPasswordRecovery(true);
      }

      applySession(normalizedSession);
      setIsLoading(false);
    }

    void loadSession();

    async function handleAuthStateChange(event: string, nextSession: Session | null) {
      const normalizedSession = await normalizeSessionUser(nextSession);

      if (!isMounted) {
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
        clearPendingOAuthRedirect();
      } else if (event === 'SIGNED_IN' && !isResetPasswordPath(window.location.pathname)) {
        setIsPasswordRecovery(false);

        if (
          hasPendingOAuthRedirectForCurrentPath('google')
          && !isAuthPath(window.location.pathname)
        ) {
          clearPendingOAuthRedirect();
        }
      }

      setAuthError(null);
      applySession(normalizedSession);
      setIsLoading(false);
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void handleAuthStateChange(event, nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signIn({ email, password }: AuthFormValues): Promise<AuthActionResult> {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw normalizeError(error, 'Unable to sign in.');
    }

    return {
      message: 'Signed in successfully.',
      requiresEmailConfirmation: false,
    };
  }

  async function signInWithOAuth(provider: OAuthProvider): Promise<void> {
    markPendingOAuthRedirect(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: buildOAuthRedirectUrl(),
      },
    });

    if (error) {
      clearPendingOAuthRedirect();
      throw normalizeError(error, `Unable to continue with ${provider}.`);
    }
  }

  async function signUp({ displayName, email, password }: AuthFormValues): Promise<AuthActionResult> {
    if (!meetsMinimumPasswordLength(password)) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw normalizeError(error, 'Unable to create account.');
    }

    return {
      message: data.session
        ? 'Account created and signed in.'
        : 'Account created. Check your email to confirm it before logging in.',
      requiresEmailConfirmation: !data.session,
    };
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw normalizeError(error, 'Unable to sign out.');
    }
  }

  async function requestPasswordReset({ email }: PasswordResetRequestValues): Promise<AuthActionResult> {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      throw normalizeError(error, 'Unable to send a password reset email.');
    }

    return {
      message: 'If an account exists for that email, a password reset link has been sent.',
      requiresEmailConfirmation: false,
    };
  }

  async function resendConfirmationEmail({
    email,
  }: ResendConfirmationRequestValues): Promise<AuthActionResult> {
    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      throw normalizeError(error, 'Unable to resend the confirmation email.');
    }

    return {
      message: 'If an unconfirmed account exists for that email, a new confirmation link has been sent.',
      requiresEmailConfirmation: true,
    };
  }

  async function completePasswordReset({ password }: PasswordUpdateValues): Promise<AuthActionResult> {
    if (!meetsMinimumPasswordLength(password)) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      throw normalizeError(error, 'Unable to update your password.');
    }

    setIsPasswordRecovery(false);
    await refreshUser();

    return {
      message: 'Password updated successfully.',
      requiresEmailConfirmation: false,
    };
  }

  async function refreshUser() {
    const [{ data: sessionData, error: sessionError }, { data: userData, error: userError }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.auth.getUser(),
    ]);

    if (sessionError) {
      throw normalizeError(sessionError, 'Unable to refresh session.');
    }

    if (userError) {
      throw normalizeError(userError, 'Unable to refresh user.');
    }

    const nextSession = sessionData.session;

    if (nextSession && userData.user) {
      applySession({
        ...nextSession,
        user: userData.user,
      });
      return;
    }

    applySession(nextSession);
  }

  async function updateAccount(values: AccountSettingsValues): Promise<AuthActionResult> {
    if (!session) {
      throw new Error('You must be signed in to update your profile.');
    }

    const normalizedDisplayName = values.displayName.trim();
    const normalizedAvatarUrl = values.avatarUrl?.trim() || null;
    const updatePayload: UserAttributes = {};

    if (!normalizedDisplayName) {
      throw new Error('Display name is required.');
    }

    if (normalizedDisplayName !== user?.displayName || normalizedAvatarUrl !== user?.avatarUrl) {
      updatePayload.data = {
        display_name: normalizedDisplayName,
        avatar_url: normalizedAvatarUrl,
      };
    }

    if (Object.keys(updatePayload).length > 0) {
      const { error } = await supabase.auth.updateUser(updatePayload);

      if (error) {
        throw normalizeError(error, 'Unable to update your profile.');
      }
    }

    await updateProfileSettings(
      session.access_token,
      normalizedDisplayName,
      normalizedAvatarUrl,
      values.autoUseStreakSavers,
    );

    if (Object.keys(updatePayload).length > 0) {
      await refreshUser();
    }

    return {
      message: 'Settings updated.',
      requiresEmailConfirmation: false,
    };
  }

  async function getAccountDeletionStatus(): Promise<AccountDeletionStatus> {
    if (!session) {
      throw new Error('You must be signed in to manage account deletion.');
    }

    return await getAccountDeletionStatusRequest(session.access_token);
  }

  async function deleteAccount(): Promise<AuthActionResult> {
    if (!session) {
      throw new Error('You must be signed in to delete your account.');
    }

    await deleteProfileAccount(session.access_token);

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('Sign-out after account deletion reported an error.', error);
    }

    applySession(null);
    setIsPasswordRecovery(false);

    return {
      message: 'Account deleted.',
      requiresEmailConfirmation: false,
    };
  }

  return (
    <AuthContext.Provider
      value={{
        authError,
        completePasswordReset,
        deleteAccount,
        getAccountDeletionStatus,
        isAuthenticated: Boolean(session),
        isLoading,
        isPasswordRecovery,
        refreshUser,
        requestPasswordReset,
        resendConfirmationEmail,
        session,
        signIn,
        signInWithOAuth,
        signOut,
        signUp,
        updateAccount,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}
