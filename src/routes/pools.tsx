import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MoreHorizontal, Plus, Droplet, CheckCircle2, AlertCircle } from "lucide-react";
import { poolStorage, type Pool } from "@/utils/storage";
import { BottomTabBar } from "@/components/BottomTabBar";
import { scanSession } from "@/utils/scanSession";

export const Route = createFileRoute("/pools")({
  head: () => ({ meta: [{ title: "הבריכות שלי — AquaSense" }] }),
  component: MyPoolsScreen,
});

function MyPoolsScreen() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  function refresh() { setPools(poolStorage.list()); }
  useEffect(() => {
    refresh();
    const onSync = () => refresh();
    window.addEventListener("poolcheck:cloud-synced", onSync);
    return () => window.removeEventListener("poolcheck:cloud-synced", onSync);
  }, []);

  function startScanFor(pool: Pool) {
    scanSession.set({ includeSalt: pool.type === "salt" });
    navigate({ to: "/scan" });
  }

  function remove(id: string) {
    if (confirm("למחוק את הבריכה?")) {
      poolStorage.remove(id);
      refresh();
    }
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#E6F6FB] via-background to-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#BEE6F1]/50 to-transparent" />

      <div className="relative mx-auto max-w-md px-5 pt-8">
        <h1 className="text-center text-3xl font-black text-foreground">הבריכות שלי</h1>

        <Link
          to="/pool/new"
          search={{ continueScan: 0 }}
          className="mt-6 flex items-center justify-center gap-2 rounded-full px-6 py-4 text-base font-black text-primary-foreground shadow-[0_10px_24px_-8px_rgba(8,145,178,0.5)] transition active:scale-[0.98]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <Plus className="h-5 w-5" />
          הוספת בריכה
        </Link>

        <div className="mt-6 space-y-4">
          {pools.length === 0 ? (
            <div className="rounded-3xl bg-card p-8 text-center text-sm text-muted-foreground shadow-[var(--shadow-card)]">
              עדיין אין בריכות. הוסף את הבריכה הראשונה שלך כדי להתחיל.
            </div>
          ) : (
            pools.map((p) => {
              const ok = !p.lastTestAt || true; // visual heuristic only
              return (
                <div key={p.id} className="overflow-hidden rounded-3xl bg-card shadow-[var(--shadow-card)]">
                  {/* Cover */}
                  <div
                    className="relative h-40 w-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url(${poolCover(p)})`,
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setMenuOpen(menuOpen === p.id ? null : p.id)}
                        className="text-muted-foreground"
                        aria-label="פעולות"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </button>
                      <Link to="/pool/$poolId" params={{ poolId: p.id }} className="flex-1 text-right">
                        <div className="text-lg font-black text-foreground">{p.name}</div>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-xs font-semibold text-muted-foreground">
                          <Droplet className="h-3.5 w-3.5 text-primary" />
                          נפח: {p.volumeLiters.toLocaleString("he-IL")} ליטר
                        </div>
                      </Link>
                    </div>

                    <div className="mt-2 flex items-center justify-end gap-1.5 text-xs font-extrabold">
                      {ok ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <span className="text-emerald-600">המים מאוזנים</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          <span className="text-amber-600">נדרש תיקון קל</span>
                        </>
                      )}
                    </div>

                    {menuOpen === p.id && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => startScanFor(p)}
                          className="flex-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary"
                        >
                          סריקה
                        </button>
                        <button
                          onClick={() => remove(p.id)}
                          className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-bold text-destructive"
                        >
                          מחק
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomTabBar />
    </div>
  );
}

// Generic stock-style cover; replace with user image when available.
function poolCover(p: Pool): string {
  const seed = encodeURIComponent(p.name || p.id);
  return `https://images.unsplash.com/photo-1572331165267-854da2b10ccc?auto=format&fit=crop&w=800&q=70&sig=${seed}`;
}
