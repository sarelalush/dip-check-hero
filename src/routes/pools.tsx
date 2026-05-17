import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Trash2, Camera, Plus } from "lucide-react";
import { poolStorage, type Pool } from "@/utils/storage";
import { scanSession } from "@/utils/scanSession";

export const Route = createFileRoute("/pools")({
  head: () => ({ meta: [{ title: "הבריכות שלי — PoolCheck" }] }),
  component: MyPoolsScreen,
});

function MyPoolsScreen() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);

  function refresh() { setPools(poolStorage.list()); }
  useEffect(() => {
    refresh();
    const onSync = () => refresh();
    window.addEventListener("poolcheck:cloud-synced", onSync);
    return () => window.removeEventListener("poolcheck:cloud-synced", onSync);
  }, []);

  function startScanFor(pool: Pool) {
    scanSession.set({ includeSalt: pool.type === "salt" });
    // Stash chosen pool id by setting session results=undefined; user will scan and we route via select-pool
    navigate({ to: "/scan" });
  }

  function remove(id: string) {
    if (confirm("למחוק את הבריכה?")) {
      poolStorage.remove(id);
      refresh();
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">הבריכות שלי</h1>

        <Link
          to="/pool/new"
          search={{ continueScan: 0 }}
          className="mt-6 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-4 font-semibold text-primary transition active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" /> הוסף בריכה חדשה
        </Link>

        <div className="mt-6 space-y-3">
          {pools.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              עדיין אין בריכות. הוסף את הבריכה הראשונה שלך כדי להתחיל.
            </p>
          ) : (
            pools.map((p) => (
              <div key={p.id} className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="flex items-start justify-between gap-3">
                  <Link to="/pool/$poolId" params={{ poolId: p.id }} className="flex-1 text-right">
                    <div className="font-bold text-foreground">{p.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {p.type === "salt" ? "בריכת מלח" : "כלור רגיל"} · {p.volumeLiters.toLocaleString("he-IL")} ליטר
                    </div>
                    {p.lastTestAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        בדיקה אחרונה: {new Date(p.lastTestAt).toLocaleDateString("he-IL")}
                      </div>
                    )}
                  </Link>
                  <button onClick={() => remove(p.id)} className="text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <button
                  onClick={() => startScanFor(p)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary"
                >
                  <Camera className="h-4 w-4" /> בדיקה חדשה לבריכה זו
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
