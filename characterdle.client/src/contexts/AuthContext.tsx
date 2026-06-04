import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session, User, UserAttributes } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AccountSettingsValues, AuthActionResult, AuthFormValues } from '../types/auth';
import type { UserProfile } from '../types/user';

interface AuthContextValue {
  authError: Error | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
  session: Session | null;
  signIn: (values: AuthFormValues) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  signUp: (values: AuthFormValues) => Promise<AuthActionResult>;
  updateAccount: (values: AccountSettingsValues) => Promise<AuthActionResult>;
  user: UserProfile | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function buildUserProfile(user: User): UserProfile {
  const displayName = typeof user.user_metadata.display_name === 'string' && user.user_metadata.display_name.trim()
    ? user.user_metadata.display_name.trim()
    : 'ERROR';

  return {
    avatarUrl: typeof user.user_metadata.avatar_url === 'string' && user.user_metadata.avatar_url.trim()
      ? user.user_metadata.avatar_url.trim()
      : null,
    displayName,
    email: user.email?.trim() || 'ERROR',
    id: user.id,
  };
}

function normalizeError(error: unknown, fallbackMessage: string) {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [authError, setAuthError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  function applySession(nextSession: Session | null) {
    setSession(nextSession);
    setUser(nextSession ? buildUserProfile(nextSession.user) : null);
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

      applySession(data.session);
      setIsLoading(false);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMounted) {
        return;
      }

      setAuthError(null);
      applySession(nextSession);
      setIsLoading(false);
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

  async function signUp({ displayName, email, password }: AuthFormValues): Promise<AuthActionResult> {
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
    const normalizedEmail = values.email.trim();
    const normalizedAvatarUrl = values.avatarUrl.trim();
    const currentAvatarUrl = user?.avatarUrl ?? '';
    const updatePayload: UserAttributes = {};

    if (!normalizedDisplayName) {
      throw new Error('Display name is required.');
    }

    if (!normalizedEmail) {
      throw new Error('Email is required.');
    }

    if (normalizedDisplayName !== user?.displayName || normalizedAvatarUrl !== currentAvatarUrl) {
      updatePayload.data = {
        avatar_url: normalizedAvatarUrl || null,
        display_name: normalizedDisplayName,
      };
    }

    if (normalizedEmail !== user?.email) {
      updatePayload.email = normalizedEmail;
    }

    if (values.password.trim()) {
      updatePayload.password = values.password;
    }

    if (Object.keys(updatePayload).length === 0) {
      return {
        message: 'No changes to save.',
        requiresEmailConfirmation: false,
      };
    }

    const { error } = await supabase.auth.updateUser(updatePayload);

    if (error) {
      throw normalizeError(error, 'Unable to update your profile.');
    }

    await refreshUser();

    return {
      message: normalizedEmail !== user?.email
        ? 'Profile updated. Check your email if you changed your address.'
        : 'Profile updated.',
      requiresEmailConfirmation: false,
    };
  }

  return (
    <AuthContext.Provider
      value={{
        authError,
        isAuthenticated: Boolean(session),
        isLoading,
        refreshUser,
        session,
        signIn,
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
