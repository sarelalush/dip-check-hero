import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as AppleAuthentication from 'expo-apple-authentication';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, supabase, supabaseConfigMessage } from '../integrations/supabase/client';

WebBrowser.maybeCompleteAuthSession();

interface AuthResult {
  error?: string;
  requiresPasswordSetup?: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  accountId?: string;
  loading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  isConfigured: boolean;
  entitlementsVersion: number;
  continueAsGuest: () => Promise<AuthResult>;
  refreshEntitlements: () => void;
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
const GUEST_MODE_PAUSED_STORAGE_KEY = '@aquasense/guest-mode-paused-v1';
const GUEST_SESSION_STORAGE_KEY = 'aquasense-guest-session-v2';
const GUEST_ACCESS_TOKEN_STORAGE_KEY = 'aquasense-guest-access-token-v1';
const GUEST_REFRESH_TOKEN_STORAGE_KEY = 'aquasense-guest-refresh-token-v1';
const GUEST_USER_ID_STORAGE_KEY = 'aquasense-guest-user-id-v1';
const APPLE_NONCE_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._';

interface SavedGuestSession {
  accessToken: string;
  refreshToken: string;
  userId: string;
}

let guestSessionWriteQueue = Promise.resolve();

async function generateAppleNonce(length = 32) {
  const bytes = await Crypto.getRandomBytesAsync(length);
  return Array.from(bytes)
    .map((byte) => APPLE_NONCE_CHARS[byte % APPLE_NONCE_CHARS.length])
    .join('');
}

function normalizeEmail(email: string) {
  return email
    .normalize('NFKC')
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLowerCase();
}

async function setProtectedItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(`@${key}`, value);
    return;
  }

  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getProtectedItem(key: string) {
  if (Platform.OS === 'web') {
    return AsyncStorage.getItem(`@${key}`);
  }

  return SecureStore.getItemAsync(key);
}

async function deleteProtectedItem(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(`@${key}`);
    return;
  }

  await SecureStore.deleteItemAsync(key);
}

async function saveGuestSession(guestSession: Session | null) {
  if (!guestSession?.user.is_anonymous) return;

  const savedGuestSession: SavedGuestSession = {
    accessToken: guestSession.access_token,
    refreshToken: guestSession.refresh_token,
    userId: guestSession.user.id,
  };

  guestSessionWriteQueue = guestSessionWriteQueue
    .catch(() => undefined)
    .then(() => setProtectedItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(savedGuestSession)));
  await guestSessionWriteQueue;
}

async function clearSavedGuestSession() {
  await guestSessionWriteQueue.catch(() => undefined);
  await Promise.all([
    deleteProtectedItem(GUEST_SESSION_STORAGE_KEY),
    deleteProtectedItem(GUEST_ACCESS_TOKEN_STORAGE_KEY),
    deleteProtectedItem(GUEST_REFRESH_TOKEN_STORAGE_KEY),
    deleteProtectedItem(GUEST_USER_ID_STORAGE_KEY),
  ]);
}

async function getSavedGuestSession(): Promise<SavedGuestSession | null> {
  await guestSessionWriteQueue.catch(() => undefined);
  const serializedSession = await getProtectedItem(GUEST_SESSION_STORAGE_KEY);

  if (serializedSession) {
    try {
      const parsed = JSON.parse(serializedSession) as Partial<SavedGuestSession>;
      if (parsed.accessToken && parsed.refreshToken && parsed.userId) {
        return {
          accessToken: parsed.accessToken,
          refreshToken: parsed.refreshToken,
          userId: parsed.userId,
        };
      }
    } catch (error) {
      console.warn('Failed to read saved guest session', error);
    }
  }

  // One-time migration for installations that saved the guest in three v1 keys.
  const [accessToken, refreshToken, userId] = await Promise.all([
    getProtectedItem(GUEST_ACCESS_TOKEN_STORAGE_KEY),
    getProtectedItem(GUEST_REFRESH_TOKEN_STORAGE_KEY),
    getProtectedItem(GUEST_USER_ID_STORAGE_KEY),
  ]);

  if (!accessToken || !refreshToken || !userId) return null;

  const migratedSession = { accessToken, refreshToken, userId };
  await setProtectedItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(migratedSession));
  return migratedSession;
}

function isInvalidGuestSessionError(message: string) {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('invalid refresh token') ||
    normalizedMessage.includes('refresh token not found') ||
    normalizedMessage.includes('session from session_id claim in jwt does not exist')
  );
}

async function restoreSavedGuestSession() {
  const savedGuestSession = await getSavedGuestSession();

  if (!savedGuestSession) return false;

  const { data, error } = await getSupabaseClient().auth.setSession({
    access_token: savedGuestSession.accessToken,
    refresh_token: savedGuestSession.refreshToken,
  });

  if (error) {
    if (isInvalidGuestSessionError(error.message)) {
      await clearSavedGuestSession();
    }
    throw error;
  }

  if (!data.user?.is_anonymous || data.user.id !== savedGuestSession.userId) {
    await clearSavedGuestSession();
    throw new Error('Saved guest session resolved to a different user.');
  }

  await saveGuestSession(data.session);
  return true;
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
  const [guestModePaused, setGuestModePaused] = useState(false);
  const [entitlementsVersion, setEntitlementsVersion] = useState(0);
  const handledOAuthUrls = useRef(new Set<string>());
  const hydrateSessionRunId = useRef(0);
  const guestModePausedRef = useRef(false);
  const authBootstrapCompleteRef = useRef(false);
  const continueAsGuestPromiseRef = useRef<Promise<AuthResult> | null>(null);

  const passwordRecoveryPending = Boolean(passwordRecoveryExpiresAt && Date.now() < passwordRecoveryExpiresAt);

  async function updateGuestModePaused(paused: boolean) {
    guestModePausedRef.current = paused;
    setGuestModePaused(paused);

    if (paused) {
      await AsyncStorage.setItem(GUEST_MODE_PAUSED_STORAGE_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(GUEST_MODE_PAUSED_STORAGE_KEY);
    }
  }

  async function hydrateSession(nextSession: Session | null) {
    const runId = hydrateSessionRunId.current + 1;
    hydrateSessionRunId.current = runId;
    setLoading(true);
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setAccountId(undefined);

    if (!nextSession?.user) {
      if (hydrateSessionRunId.current === runId) {
        setLoading(false);
      }
      return;
    }

    try {
      const { data, error } = await getSupabaseClient().rpc('ensure_default_account');
      if (error) throw error;
      if (hydrateSessionRunId.current === runId) {
        setAccountId(typeof data === 'string' ? data : undefined);
      }
    } catch (error) {
      console.warn('Failed to ensure default account', error);
      if (hydrateSessionRunId.current === runId) {
        setAccountId(undefined);
      }
    } finally {
      if (hydrateSessionRunId.current === runId) {
        setLoading(false);
      }
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
      if (!authBootstrapCompleteRef.current) return;

      if (nextSession?.user.is_anonymous) {
        saveGuestSession(nextSession).catch((error) => {
          console.warn('Failed to persist guest session', error);
        });
      }

      if (_event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryExpiresAt(Date.now() + PASSWORD_RECOVERY_WINDOW_MS);
      }
      if (nextSession?.user && !nextSession.user.is_anonymous && guestModePausedRef.current) {
        updateGuestModePaused(false).catch((error) => {
          console.warn('Failed to resume authenticated mode', error);
        });
      }
      hydrateSession(nextSession);
    });

    Promise.resolve()
      .then(async () => {
        const storedGuestModePaused = await AsyncStorage.getItem(GUEST_MODE_PAUSED_STORAGE_KEY);
        guestModePausedRef.current = storedGuestModePaused === 'true';
        setGuestModePaused(guestModePausedRef.current);
        authBootstrapCompleteRef.current = true;
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

  const guestSessionHidden = guestModePaused && Boolean(user?.is_anonymous);
  const visibleSession = guestSessionHidden ? null : session;
  const visibleUser = guestSessionHidden ? null : user;
  const visibleAccountId = guestSessionHidden ? undefined : accountId;

  const value = useMemo<AuthContextValue>(
    () => ({
      user: visibleUser,
      session: visibleSession,
      accountId: visibleAccountId,
      passwordRecoveryExpiresAt,
      passwordRecoveryPending,
      loading,
      isAuthenticated: Boolean(visibleUser),
      isGuest: Boolean(visibleUser?.is_anonymous),
      isConfigured: isSupabaseConfigured,
      entitlementsVersion,
      async continueAsGuest() {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        if (continueAsGuestPromiseRef.current) return continueAsGuestPromiseRef.current;

        const continuePromise = (async (): Promise<AuthResult> => {
          try {
            const { data: currentSessionData } = await getSupabaseClient().auth.getSession();
            const currentSession = currentSessionData.session;

            if (currentSession?.user.is_anonymous) {
              await saveGuestSession(currentSession);
              await updateGuestModePaused(false);
              return {};
            }
            if (currentSession?.user) return {};

            if (await restoreSavedGuestSession()) {
              await updateGuestModePaused(false);
              return {};
            }

            // A new anonymous identity is created only when this installation has
            // never stored one (or Supabase has definitively invalidated it).
            const { data, error } = await getSupabaseClient().auth.signInAnonymously();
            if (error) return { error: toHebrewAuthError(error.message) };
            await saveGuestSession(data.session);
            await updateGuestModePaused(false);
            return {};
          } catch (error) {
            return { error: toHebrewAuthError(error instanceof Error ? error.message : '') };
          }
        })();

        continueAsGuestPromiseRef.current = continuePromise;
        try {
          return await continuePromise;
        } finally {
          if (continueAsGuestPromiseRef.current === continuePromise) {
            continueAsGuestPromiseRef.current = null;
          }
        }
      },
      refreshEntitlements() {
        setEntitlementsVersion((version) => version + 1);
      },
      async signInWithEmail(email, password) {
        if (!isSupabaseConfigured) return { error: supabaseConfigMessage };

        try {
          await saveGuestSession(session);
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
          if (user?.is_anonymous) {
            const { error } = await getSupabaseClient().auth.updateUser({
              email: normalizeEmail(email),
              data: {
                display_name: displayName?.trim() || null,
                phone: phone?.trim() || null,
              },
            });

            return error ? { error: toHebrewAuthError(error.message) } : { requiresPasswordSetup: true };
          }

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
          await saveGuestSession(session);
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
          await saveGuestSession(session);
          const available = await AppleAuthentication.isAvailableAsync();
          if (!available) {
            return { error: 'התחברות עם Apple אינה זמינה במכשיר הזה.' };
          }

          const rawNonce = await generateAppleNonce();
          const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
          const credential = await AppleAuthentication.signInAsync({
            nonce: hashedNonce,
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });

          if (!credential.identityToken) {
            return { error: 'לא התקבל אסימון תקין מ-Apple. נסה שוב.' };
          }

          const { data, error } = await getSupabaseClient().auth.signInWithIdToken({
            nonce: rawNonce,
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
        if (user?.is_anonymous) {
          await saveGuestSession(session);
          await updateGuestModePaused(true);
          setPasswordRecoveryExpiresAt(undefined);
          return;
        }

        if (!isSupabaseConfigured) {
          setSession(null);
          setUser(null);
          setAccountId(undefined);
          return;
        }

        try {
          await getSupabaseClient().auth.signOut();
          const restoredGuest = await restoreSavedGuestSession();
          if (restoredGuest) {
            await updateGuestModePaused(true);
          }
        } finally {
          const { data } = await getSupabaseClient().auth.getSession();
          if (!data.session?.user.is_anonymous) {
            setSession(null);
            setUser(null);
            setAccountId(undefined);
          }
          setPasswordRecoveryExpiresAt(undefined);
        }
      },
    }),
    [
      accountId,
      entitlementsVersion,
      guestModePaused,
      loading,
      passwordRecoveryExpiresAt,
      passwordRecoveryPending,
      session,
      user,
      visibleAccountId,
      visibleSession,
      visibleUser,
    ],
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
