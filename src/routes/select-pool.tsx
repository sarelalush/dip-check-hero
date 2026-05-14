import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { poolStorage, type Pool } from "@/utils/storage";
import { PoolCard } from "@/components/PoolCard";
import { scanSession } from "@/utils/scanSession";
import { calculateDosage } from "@/utils/calculateDosage";
import { testStorage, newId } from "@/utils/storage";

export const Route = createFileRoute("/select-pool")({
  head: () => ({ meta: [{ title: "בחר בריכה — PoolCheck" }] }),
  component: SelectPoolScreen,
});

function SelectPoolScreen() {
  const navigate = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);

  useEffect(() => {
    setPools(poolStorage.list());
  }, []);

  function selectPool(pool: Pool) {
    const sess = scanSession.get();
    if (!sess.results) {
      navigate({ to: "/scan" });
      return;
    }
    const recs = calculateDosage(sess.results, pool);
    const test = {
      id: newId(),
      poolId: pool.id,
      date: Date.now(),
      results: sess.results,
      recommendations: recs,
      imageDataUrl: sess.imageDataUrl,
    };
    testStorage.save(test);
    navigate({ to: "/results/$testId", params: { testId: test.id } });
  }

  const hasScan = !!scanSession.get().results;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to={hasScan ? "/scan" : "/"} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        {hasScan && (
          <div
            className="relative mb-5 overflow-hidden rounded-3xl p-5 text-primary-foreground shadow-[var(--shadow-soft)]"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="pointer-events-none absolute -left-8 -bottom-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <div className="text-[11px] font-semibold tracking-[0.2em] text-white/80">שלב 2 מתוך 3</div>
            <h1 className="mt-1 text-2xl font-extrabold leading-tight">לאיזו בריכה?</h1>
            <p className="mt-1 text-sm text-white/85">בחר בריכה כדי לחשב את ההמלצה המדויקת</p>
          </div>
        )}

        {!hasScan && (
          <>
            <h1 className="text-2xl font-extrabold text-foreground">בחר בריכה</h1>
            <p className="mt-1 text-sm text-muted-foreground">לאיזו בריכה לחשב את ההמלצה?</p>
          </>
        )}

        <Link
          to="/pool/new"
          search={{ continueScan: hasScan ? 1 : 0 }}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-4 font-semibold text-primary transition hover:bg-primary/10 active:scale-[0.98]"
        >
          <Plus className="h-5 w-5" />
          הוסף בריכה חדשה
        </Link>

        <div className="mt-6 space-y-3">
          {pools.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              אין בריכות שמורות. הוסף בריכה כדי לקבל חישוב מינון.
            </p>
          ) : (
            pools.map((p) =>
              hasScan ? (
                <PoolCard key={p.id} pool={p} onClick={() => selectPool(p)} />
              ) : (
                <PoolCard key={p.id} pool={p} to="/pools" />
              )
            )
          )}
        </div>
      </div>
    </div>
  );
}
