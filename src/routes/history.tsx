import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { MySection, type PoolRow, type TestRow } from "@/components/ScanHistory";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "ההיסטוריה שלי — PoolCheck" }] }),
  component: HistoryScreen,
});

function HistoryScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      supabase.from("tests").select("*").eq("user_id", user.id).order("tested_at", { ascending: false }),
      supabase.from("pools").select("id, user_id, name").eq("user_id", user.id),
    ]).then(([t, p]) => {
      if (cancelled) return;
      setTests((t.data ?? []) as TestRow[]);
      setPools((p.data ?? []) as PoolRow[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const poolName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pools) m.set(p.id, p.name);
    return m;
  }, [pools]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה לעמוד הראשי
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <History className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">ההיסטוריה שלי</h1>
            <p className="text-sm text-muted-foreground">סריקות, דוחות ומגמות לאורך זמן</p>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <MySection userId={user.id} tests={tests} pools={pools} poolName={poolName} />
          )}
        </div>
      </div>
    </div>
  );
}
