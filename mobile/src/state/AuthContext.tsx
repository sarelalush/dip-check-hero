import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured, supabase, supabaseConfigMessage } from '../integrations/supabase/client';

interface AuthResult {
  error?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAuthenticated: boolean;
  isConfigured: boolean;
  signInWithEmail: (email: string, password: string) => Promise<AuthResult>;
  signUpWithEmail: (email: string, password: string, displayName?: string, phone?: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toHebrewAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return 'האימייל או הסיסמה אינם נכונים.';
  if (lower.includes('email not confirmed')) return 'יש לאשר את האימייל לפני התחברות.';
  if (lower.includes('password')) return 'הסיסמה אינה עומדת בדרישות או אינה נכונה.';
  if (lower.includes('already registered') || lower.includes('already exists')) return 'קיים כבר חשבון עם האימייל הזה.';
  if (lower.includes('email')) return 'כתובת האימייל אינה תקינה.';

  return message || 'אירעה שגיאה. נסו שוב בעוד רגע.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch(() => {
        setSession(null);
        setUser(null);
      })
      .finally(() => setLoading(false));

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
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
      async signOut() {
        if (!isSupabaseConfigured) {
          setSession(null);
          setUser(null);
          return;
        }

        try {
          await getSupabaseClient().auth.signOut();
        } finally {
          setSession(null);
          setUser(null);
        }
      },
    }),
    [loading, session, user],
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
