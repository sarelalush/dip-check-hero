import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal, ChevronLeft, CheckCircle2, ArrowDownCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BottomTabBar } from "@/components/BottomTabBar";
import type { TestRow, PoolRow } from "@/components/ScanHistory";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "היסטוריית בדיקות — AquaSense" }] }),
  component: HistoryScreen,
});

type Filter = "all" | "ok" | "issues";

function HistoryScreen() {
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [tests, setTests] = useState<TestRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [filterOpen, setFilterOpen] = useState(false);

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
    return () => { cancelled = true; };
  }, [user]);

  const poolName = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pools) m.set(p.id, p.name);
    return m;
  }, [pools]);

  const filteredTests = useMemo(() => {
    if (filter === "all") return tests;
    return tests.filter((t) => (filter === "ok" ? inferOk(t) : !inferOk(t)));
  }, [tests, filter]);

  const filterLabel = filter === "all" ? "סינון" : filter === "ok" ? "מאוזנים" : "דורש תיקון";

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#E6F6FB] via-background to-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#BEE6F1]/50 to-transparent" />

      <div className="relative mx-auto max-w-md px-5 pt-8">
        <div className="flex items-center justify-between">
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold shadow-sm transition ${
                filter === "all" ? "bg-card text-foreground" : "bg-primary text-primary-foreground"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filterLabel}
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-card)] ring-1 ring-border">
                  {([
                    { id: "all", label: "הכל" },
                    { id: "ok", label: "מאוזנים" },
                    { id: "issues", label: "דורש תיקון" },
                  ] as { id: Filter; label: string }[]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { setFilter(opt.id); setFilterOpen(false); }}
                      className={`block w-full px-4 py-2.5 text-right text-sm font-bold transition ${
                        filter === opt.id ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <h1 className="text-2xl font-black text-foreground">היסטוריית בדיקות</h1>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="mt-10 rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            {tests.length === 0
              ? "עדיין אין בדיקות. בצע סריקה ראשונה כדי שתוצאות יופיעו כאן."
              : "אין בדיקות התואמות לסינון."}
          </div>
        ) : (
          <div className="relative mt-6 pr-6">
            {/* Timeline rail */}
            <div className="absolute right-2 top-3 bottom-3 w-0.5 bg-border" />
            <div className="space-y-3">
              {filteredTests.map((t) => {
                const ok = inferOk(t);
                return (
                  <Link
                    key={t.id}
                    to="/results/$testId"
                    params={{ testId: t.id }}
                    className="relative flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)] transition active:scale-[0.99]"
                  >
                    {/* Dot on timeline */}
                    <span
                      className={`absolute -right-[22px] top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-background ${
                        ok ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 text-right">
                      <div className="text-sm font-bold text-foreground">
                        {formatHebrewDate(t.tested_at)}
                      </div>
                      <div className={`mt-0.5 flex items-center justify-end gap-1 text-xs font-extrabold ${ok ? "text-emerald-600" : "text-amber-600"}`}>
                        {ok ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            המים מאוזנים
                          </>
                        ) : (
                          <>
                            <ArrowDownCircle className="h-3.5 w-3.5" />
                            נדרש תיקון קל
                          </>
                        )}
                      </div>
                      {poolName.get(t.pool_id) && (
                        <div className="text-[11px] text-muted-foreground">{poolName.get(t.pool_id)}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}

function formatHebrewDate(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
  const month = d.toLocaleDateString("he-IL", { month: "long" });
  return `${d.getDate()} ב${month} ${time}`;
}

function inferOk(t: TestRow): boolean {
  const r = (t.results ?? {}) as Record<string, { status?: string } | undefined>;
  return Object.values(r).every((v) => !v?.status || v.status === "ok");
}
