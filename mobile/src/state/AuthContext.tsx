import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
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
  resetPasswordForEmail: (email: string) => Promise<AuthResult>;
  passwordRecoveryExpiresAt?: number;
  passwordRecoveryPending: boolean;
  signInWithApple: () => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  completePasswordReset: (password: string) => Promise<AuthResult>;
  clearPasswordRecovery: () => void;
  updateDisplayName: (displayName: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PASSWORD_RECOVERY_WINDOW_MS = 5 * 60 * 1000;

function normalizeEmail(email: string) {
  return email
    .normalize('NFKC')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

function toHebrewAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('rate limit') || lower.includes('too many') || lower.includes('over email send rate limit')) {
    return 'נשלחו יותר מדי בקשות בזמן קצר. נסה שוב בעוד כמה דקות.';
  }
  if (lower.includes('cancel')) return 'ההתחברות בוטלה.';
  if (lower.includes('provider') || lower.includes('oauth')) return 'התחברות חיצונית אינה מוגדרת עדיין ב-Supabase.';
  if (lower.includes('redirect')) return 'כתובת החזרה אינה מוגדרת נכון.';
  if (lower.includes('invalid login credentials')) return 'האימייל או הסיסמה אינם נכונים.';
  if (lower.includes('email not confirmed')) return 'יש לאשר את האימייל לפני התחברות.';
  if (lower.includes('password')) return 'הסיסמה אינה עומדת בדרישות או אינה נכונה.';
  if (lower.includes('already registered') || lower.includes('already exists')) return 'קיים כבר חשבון עם האימייל הזה.';
  if (lower.includes('email')) return 'כתובת האימייל אינה תקינה.';

  return message || 'אירעה שגיאה. נסו שוב בעוד רגע.';
}

function getOAuthRedirectTo() {
  if (Platform.OS !== 'web') {
    return 'aquasense://auth/callback';
  }

  return makeRedirectUri({
    scheme: 'aquasense',
    path: 'auth/callback',
  });
}

function getPasswordResetRedirectTo() {
  if (Platform.OS !== 'web') {
    return 'aquasense://auth/reset-password';
  }

  return makeRedirectUri({
    scheme: 'aquasense',
    path: 'auth/reset-password',
  });
}

function isAuthCallbackUrl(url?: string | null) {
  if (!url) return false;
  const isAuthPath = url.includes('auth/callback') || url.includes('auth/reset-password');
  return isAuthPath && (url.includes('access_token=') || url.includes('code='));
}

function isPasswordRecoveryUrl(url?: string | null) {
  if (!url) return false;
  return url.includes('auth/reset-password') || url.includes('type=recovery');
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
  const [passwordRecoveryExpiresAt, setPasswordRecoveryExpiresAt] = useState<number | undefined>();
  const [loading, setLoading] = useState(true);
  const handledOAuthUrls = useRef(new Set<string>());

  const passwordRecoveryPending = Boolean(passwordRecoveryExpiresAt && Date.now() < passwordRecoveryExpiresAt);

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

    const client = supabase;

    async function handleOAuthCallback(url?: string | null) {
      if (!isAuthCallbackUrl(url) || typeof url !== 'string' || handledOAuthUrls.current.has(url)) {
        return false;
      }

      handledOAuthUrls.current.add(url);
      await setSessionFromOAuthUrl(url);
      if (isPasswordRecoveryUrl(url)) {
        setPasswordRecoveryExpiresAt(Date.now() + PASSWORD_RECOVERY_WINDOW_MS);
      }
      return true;
    }

    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      handleOAuthCallback(url).catch((error) => {
        console.warn('Failed to complete OAuth callback', error);
      });
    });

    const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryExpiresAt(Date.now() + PASSWORD_RECOVERY_WINDOW_MS);
      }
      hydrateSession(nextSession);
    });

    Promise.resolve()
      .then(async () => {
        const initialUrl = await Linking.getInitialURL();
        await handleOAuthCallback(initialUrl);
        return client.auth.getSession();
      })
      .then(({ data }) => {
        return hydrateSession(data.session);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
        setAccountId(undefined);
      })
      .finally(() => setLoading(false));

    return () => {
      urlSubscription.remove();
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      accountId,
      passwordRecoveryExpiresAt,
      passwordRecoveryPending,
      loading,
      isAuthenticated: Boolean(user),
      isConfigured: isSupabaseConfigured,
      async signInWithEmail(email, password) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          const { error } = await getSupabaseClient().auth.signInWithPassword({
            email: normalizeEmail(email),
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
            email: normalizeEmail(email),
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
      async resetPasswordForEmail(email) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          const normalizedEmail = normalizeEmail(email);
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
            return { error: 'כתובת האימייל אינה תקינה.' };
          }

          const { error } = await getSupabaseClient().auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: getPasswordResetRedirectTo(),
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
      async signInWithApple() {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };
        if (Platform.OS !== 'ios') return { error: 'התחברות עם Apple זמינה רק במכשירי iOS.' };

        try {
          const available = await AppleAuthentication.isAvailableAsync();
          if (!available) {
            return { error: 'התחברות עם Apple אינה זמינה במכשיר הזה.' };
          }

          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            return { error: 'לא התקבל אסימון תקין מ-Apple. נסה שוב.' };
          }

          const { data, error } = await getSupabaseClient().auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (error) return { error: toHebrewAuthError(error.message) };

          const fullName = [
            credential.fullName?.givenName,
            credential.fullName?.middleName,
            credential.fullName?.familyName,
          ]
            .filter(Boolean)
            .join(' ')
            .trim();

          if (fullName && data.user) {
            await getSupabaseClient().auth.updateUser({
              data: {
                display_name: fullName,
                full_name: fullName,
              },
            });
          }

          return {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      async completePasswordReset(password) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };
        const recoveryStillValid = Boolean(passwordRecoveryExpiresAt && Date.now() < passwordRecoveryExpiresAt);
        if (!recoveryStillValid) {
          return { error: 'קישור האיפוס פג תוקף. יש לשלוח קישור חדש.' };
        }
        if (password.length < 6) {
          return { error: 'הסיסמה חייבת להכיל לפחות 6 תווים.' };
        }

        try {
          const { error } = await getSupabaseClient().auth.updateUser({ password });
          if (error) return { error: toHebrewAuthError(error.message) };
          setPasswordRecoveryExpiresAt(undefined);
          return {};
        } catch (error) {
          return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
        }
      },
      clearPasswordRecovery() {
        setPasswordRecoveryExpiresAt(undefined);
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
          setPasswordRecoveryExpiresAt(undefined);
        }
      },
    }),
    [accountId, loading, passwordRecoveryExpiresAt, passwordRecoveryPending, session, user],
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
