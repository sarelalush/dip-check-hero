import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, ListChecks, AlertTriangle } from "lucide-react";
import { testStorage, poolStorage, type TestRecord, type Pool } from "@/utils/storage";
import { ResultCard } from "@/components/ResultCard";
import { scanSession } from "@/utils/scanSession";

export const Route = createFileRoute("/results/$testId")({
  head: () => ({ meta: [{ title: "תוצאות הבדיקה — PoolCheck" }] }),
  component: ResultsScreen,
});

function ResultsScreen() {
  const { testId } = Route.useParams();
  const navigate = useNavigate();
  const [test, setTest] = useState<TestRecord | null>(null);
  const [pool, setPool] = useState<Pool | null>(null);

  useEffect(() => {
    // testStorage doesn't have a direct getById; load all and find
    const all = JSON.parse(localStorage.getItem("poolcheck.tests") || "[]") as TestRecord[];
    const t = all.find((x) => x.id === testId) || null;
    setTest(t);
    if (t) setPool(poolStorage.get(t.poolId) || null);
  }, [testId]);

  if (!test || !pool) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">לא נמצאה בדיקה</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to="/pools" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        <h1 className="text-2xl font-extrabold text-foreground">תוצאות הבדיקה</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pool.name} · {pool.volumeLiters.toLocaleString("he-IL")} ליטר ·{" "}
          {new Date(test.date).toLocaleDateString("he-IL")}
        </p>

        <div className="mt-5 space-y-3">
          {test.recommendations.map((rec) => (
            <ResultCard key={rec.paramKey} rec={rec} />
          ))}
        </div>

        {/* Safety warning */}
        <div className="mt-6 flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
          <p className="text-xs leading-relaxed text-foreground/90">
            החישוב הוא הערכה לפי הנתונים שהוזנו ותוצאת הסטיק. יש לפעול לפי הוראות יצרן חומרי הבריכה.
            מומלץ להוסיף חומרים בהדרגה ולבדוק שוב. אין לערבב חומרים שונים יחד.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <button
            onClick={() => { scanSession.clear(); navigate({ to: "/scan" }); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 font-bold text-primary-foreground shadow-[var(--shadow-soft)] active:scale-[0.98]"
          >
            <Camera className="h-5 w-5" /> בדיקה חדשה
          </button>
          <Link to="/pools"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-primary/20 bg-card px-6 py-3.5 font-semibold text-foreground active:scale-[0.98]">
            <ListChecks className="h-5 w-5 text-primary" /> חזור לבריכות שלי
          </Link>
        </div>
      </div>
    </div>
  );
}
