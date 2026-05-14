import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncFromCloud, clearLocalCache } from "@/lib/cloudSync";

const GUEST_KEY = "poolcheck.guest";
const GUEST_SINCE_KEY = "poolcheck.guestSince";

type AuthMode = "user" | "guest" | "anonymous";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mode: AuthMode;
  isGuest: boolean;
  isAuthenticated: boolean;
  guestExpiresAt: number | null;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [guestExpiresAt, setGuestExpiresAt] = useState<number | null>(null);

  useEffect(() => {
    // Set up listener FIRST
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setIsGuest(false);
        localStorage.removeItem(GUEST_KEY);
        localStorage.removeItem(GUEST_SINCE_KEY);
        // sync cloud data
        setTimeout(() => syncFromCloud().catch(console.error), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (!s?.user) {
        const guest = localStorage.getItem(GUEST_KEY) === "1";
        setIsGuest(guest);
        if (guest) {
          const since = parseInt(localStorage.getItem(GUEST_SINCE_KEY) || "0", 10);
          if (since) setGuestExpiresAt(since + 24 * 60 * 60 * 1000);
        }
      } else {
        syncFromCloud().catch(console.error);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    mode: user ? "user" : isGuest ? "guest" : "anonymous",
    isGuest,
    isAuthenticated: !!user,
    guestExpiresAt,
    async signInWithEmail(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return error ? { error: error.message } : {};
    },
    async signUpWithEmail(email, password, displayName) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { display_name: displayName },
        },
      });
      return error ? { error: error.message } : {};
    },
    continueAsGuest() {
      const now = Date.now();
      localStorage.setItem(GUEST_KEY, "1");
      localStorage.setItem(GUEST_SINCE_KEY, String(now));
      setIsGuest(true);
      setGuestExpiresAt(now + 24 * 60 * 60 * 1000);
    },
    async signOut() {
      await supabase.auth.signOut();
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(GUEST_SINCE_KEY);
      clearLocalCache();
      setIsGuest(false);
      setGuestExpiresAt(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
