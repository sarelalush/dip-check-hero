import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { syncFromCloud, clearLocalCache } from "@/lib/cloudSync";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mode: "user" | "anonymous";
  isGuest: false;
  isAuthenticated: boolean;
  guestExpiresAt: null;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<{ error?: string }>;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const POST_OAUTH_REDIRECT_KEY = "aquasense:postOAuthRedirect";

function consumePostOAuthRedirect(sess: Session | null) {
  if (!sess?.user || typeof window === "undefined") return;
  const target = window.sessionStorage.getItem(POST_OAUTH_REDIRECT_KEY);
  if (!target) return;
  window.sessionStorage.removeItem(POST_OAUTH_REDIRECT_KEY);
  const safeTarget = target.startsWith("/") ? target : "/select-strip";
  if (window.location.pathname !== safeTarget) {
    window.location.replace(safeTarget);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      consumePostOAuthRedirect(sess);
      if (sess?.user) {
        setTimeout(() => syncFromCloud().catch(console.error), 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      consumePostOAuthRedirect(s);
      if (s?.user) syncFromCloud().catch(console.error);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthContextValue = {
    user,
    session,
    loading,
    mode: user ? "user" : "anonymous",
    isGuest: false,
    isAuthenticated: !!user,
    guestExpiresAt: null,
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
      // Guest mode disabled — no-op
    },
    async signOut() {
      await supabase.auth.signOut();
      clearLocalCache();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
