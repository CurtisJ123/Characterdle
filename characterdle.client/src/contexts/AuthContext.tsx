import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { AuthActionResult, AuthFormValues } from '../types/auth';
import type { UserProfile } from '../types/user';

interface AuthContextValue {
  authError: Error | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  session: Session | null;
  signIn: (values: AuthFormValues) => Promise<AuthActionResult>;
  signOut: () => Promise<void>;
  signUp: (values: AuthFormValues) => Promise<AuthActionResult>;
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

      setSession(data.session);
      setUser(data.session ? buildUserProfile(data.session.user) : null);
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
      setSession(nextSession);
      setUser(nextSession ? buildUserProfile(nextSession.user) : null);
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

  return (
    <AuthContext.Provider
      value={{
        authError,
        isAuthenticated: Boolean(session),
        isLoading,
        session,
        signIn,
        signOut,
        signUp,
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
