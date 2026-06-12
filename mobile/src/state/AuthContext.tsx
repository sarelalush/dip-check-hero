import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, supabase, supabaseConfigMessage } from '../integrations/supabase/client';

WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  accountId?: string;
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName?: string, phone?: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  updateDisplayName: (displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toHebrewAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('cancel')) return 'ההתחברות עם Google בוטלה.';
  if (lower.includes('provider') || lower.includes('oauth')) return 'התחברות Google אינה מוגדרת עדיין ב-Supabase.';
  if (lower.includes('redirect')) return 'כתובת החזרה של Google אינה מוגדרת נכון.';
  if (lower.includes('invalid login credentials')) return 'האימייל או הסיסמה אינם נכונים.';
  if (lower.includes('email not confirmed')) return 'יש לאשר את האימייל לפני התחברות.';
  if (lower.includes('password')) return 'הסיסמה אינה עומדת בדרישות או אינה נכונה.';
  if (lower.includes('already registered') || lower.includes('already exists')) return 'קיים כבר חשבון עם האימייל הזה.';
  if (lower.includes('email')) return 'כתובת האימייל אינה תקינה.';

  return message || 'אירעה שגיאה. נסו שוב בעוד רגע.';
}

function getOAuthRedirectTo() {
  return makeRedirectUri({
    scheme: 'aquasense',
    path: 'auth/callback',
  });
}

async function setSessionFromOAuthUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);

  if (errorCode) {
    throw new Error(String(errorCode));
  }

  const accessToken = typeof params.access_token === 'string' ? params.access_token : undefined;
  const refreshToken = typeof params.refresh_token === 'string' ? params.refresh_token : undefined;

  if (accessToken && refreshToken) {
    const { error } = await getSupabaseClient().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) throw error;
    return;
  }

  const code = typeof params.code === 'string' ? params.code : undefined;

  if (code) {
    const { error } = await getSupabaseClient().auth.exchangeCodeForSession(code);

    if (error) throw error;
    return;
  }

  throw new Error('OAuth callback did not include a session.');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  async function hydrateSession(nextSession: Session | null) {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);

    if (!nextSession?.user) {
      setAccountId(undefined);
      return;
    }

    try {
      const { data, error } = await getSupabaseClient().rpc('ensure_default_account');
      if (error) throw error;
      setAccountId(typeof data === 'string' ? data : undefined);
    } catch (error) {
      console.warn('Failed to ensure default account', error);
      setAccountId(undefined);
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      hydrateSession(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        return hydrateSession(data.session);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setAccountId(undefined);
      })
      .finally(() => setLoading(false));

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      accountId,
      loading,
      isAuthenticated: Boolean(user),
      isConfigured: isSupabaseConfigured,
      async signInWithEmail(email, password) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          const { error } = await getSupabaseClient().auth.signInWithPassword({
            email: email.trim(),
            password,
          });

          return error ? { error: toHebrewAuthError(error.message) } : {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      async signUpWithEmail(email, password, displayName, phone) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          const { error } = await getSupabaseClient().auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: {
                display_name: displayName?.trim() || null,
                phone: phone?.trim() || null,
              },
            },
          });

          return error ? { error: toHebrewAuthError(error.message) } : {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      async signInWithGoogle() {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          const redirectTo = getOAuthRedirectTo();
          const { data, error } = await getSupabaseClient().auth.signInWithOAuth({
            provider: 'google',
            options: {
              redirectTo,
              skipBrowserRedirect: true,
            },
          });

          if (error) return { error: toHebrewAuthError(error.message) };
          if (!data.url) return { error: 'לא התקבלה כתובת התחברות מ-Google.' };

          const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

          if (result.type !== 'success') {
            return { error: toHebrewAuthError('cancelled') };
          }

          await setSessionFromOAuthUrl(result.url);

          return {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      async updateDisplayName(displayName) {
        if (!isSupabaseConfigured || !user) return { error: supabaseConfigMessage };

        const fullName = displayName.trim();
        if (!fullName) return { error: 'יש להזין שם תצוגה.' };

        try {
          const { data, error } = await getSupabaseClient().auth.updateUser({
            data: {
              display_name: fullName,
              full_name: fullName,
            },
          });

          if (error) return { error: toHebrewAuthError(error.message) };

          const { error: profileError } = await getSupabaseClient()
            .from('profiles')
            .update({ full_name: fullName, updated_at: new Date().toISOString() })
            .eq('id', user.id);

          if (profileError) return { error: toHebrewAuthError(profileError.message) };
          setUser(data.user ?? user);
          return {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      async signOut() {
        if (!isSupabaseConfigured) {
          setSession(null);
          setUser(null);
          setAccountId(undefined);
          return;
        }

        try {
          await getSupabaseClient().auth.signOut();
        } finally {
          setSession(null);
          setUser(null);
          setAccountId(undefined);
        }
      },
    }),
    [accountId, loading, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
