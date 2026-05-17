import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Shield, Users, FlaskConical, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { TestItem, type TestRow, type PoolRow } from "@/components/ScanHistory";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "לוח ניהול — PoolCheck" }] }),
  component: AdminScreen,
});

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  free_scans_used: number;
}

function AdminScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    let cancelled = false;
    Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("tests").select("*").order("tested_at", { ascending: false }),
      supabase.from("pools").select("id, user_id, name"),
    ]).then(([p, t, pl]) => {
      if (cancelled) return;
      setProfiles((p.data ?? []) as ProfileRow[]);
      setTests((t.data ?? []) as TestRow[]);
      setPools((pl.data ?? []) as PoolRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  const testsByUser = useMemo(() => {
    const map = new Map<string, TestRow[]>();
    for (const t of tests) {
      const arr = map.get(t.user_id) ?? [];
      arr.push(t);
      map.set(t.user_id, arr);
    }
    return map;
  }, [tests]);

  const poolName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pools) map.set(p.id, p.name);
    return map;
  }, [pools]);

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div dir="rtl" className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-5 pt-10 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold text-foreground">אין לך הרשאת גישה</h1>
          <p className="mt-2 text-sm text-muted-foreground">דף זה מיועד למנהלי המערכת בלבד.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-primary">
            <ArrowRight className="h-4 w-4" /> חזרה לעמוד הראשי
          </Link>
        </div>
      </div>
    );
  }

  const totalScans = tests.length;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה לעמוד הראשי
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">לוח ניהול</h1>
            <p className="text-sm text-muted-foreground">מעקב משתמשים וסריקות</p>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <StatCard icon={<Users className="h-5 w-5" />} label="משתמשים רשומים" value={profiles.length} />
          <StatCard icon={<FlaskConical className="h-5 w-5" />} label="סך סריקות" value={totalScans} />
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {profiles.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                עדיין אין משתמשים רשומים.
              </div>
            )}
            {profiles.map((p) => {
              const userTests = testsByUser.get(p.user_id) ?? [];
              const expanded = expandedUser === p.user_id;
              return (
                <div key={p.user_id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <button
                    onClick={() => setExpandedUser(expanded ? null : p.user_id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {userTests.length} סריקות
                      </span>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-foreground truncate">
                        {p.display_name || p.email || "ללא שם"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.email} · נרשם {new Date(p.created_at).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border bg-muted/30 px-4 py-3">
                      {userTests.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-3">אין סריקות למשתמש זה</p>
                      ) : (
                        <div className="space-y-2">
                          {userTests.map((t) => (
                            <TestItem key={t.id} test={t} poolName={poolName.get(t.pool_id) ?? "—"} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="mt-1 text-3xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}

