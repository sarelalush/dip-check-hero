import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Camera, TrendingUp } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import { poolStorage, testStorage, type Pool, type TestRecord } from "@/utils/storage";
import { scanSession } from "@/utils/scanSession";
import { GuestBanner } from "@/components/GuestBanner";

export const Route = createFileRoute("/pool/$poolId")({
  head: () => ({ meta: [{ title: "בריכה — AquaSense" }] }),
  component: PoolDetailScreen,
});

function PoolDetailScreen() {
  const navigate = useNavigate();
  const { poolId } = Route.useParams();
  const [pool, setPool] = useState<Pool | undefined>();
  const [tests, setTests] = useState<TestRecord[]>([]);

  useEffect(() => {
    setPool(poolStorage.get(poolId));
    setTests(testStorage.listByPool(poolId));
  }, [poolId]);

  const chartData = useMemo(() => {
    return [...tests]
      .reverse()
      .map((t) => ({
        date: new Date(t.date).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }),
        pH: t.results.readings.ph?.value,
        כלור: t.results.readings.freeChlorine?.value,
        אלקליניות: t.results.readings.alkalinity?.value,
      }));
  }, [tests]);

  if (!pool) {
    return (
      <div className="min-h-screen bg-background p-6 text-center">
        <p className="text-muted-foreground">בריכה לא נמצאה</p>
        <Link to="/pools" className="mt-4 inline-block text-primary">חזרה לרשימה</Link>
      </div>
    );
  }

  function startScan() {
    if (!pool) return;
    scanSession.set({ includeSalt: pool.type === "salt" });
    navigate({ to: "/scan" });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to="/pools" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>
        <GuestBanner />

        <div className="rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-soft)]"
             style={{ background: "var(--gradient-hero)" }}>
          <h1 className="text-2xl font-extrabold">{pool.name}</h1>
          <p className="mt-1 text-sm text-primary-foreground/90">
            {pool.type === "salt" ? "בריכת מלח" : "כלור רגיל"} · {pool.volumeLiters.toLocaleString("he-IL")} ליטר
          </p>
        </div>

        <button onClick={startScan}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)]">
          <Camera className="h-5 w-5" /> בדיקה חדשה
        </button>

        {/* Chart */}
        <section className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">מגמה לאורך זמן</h2>
          </div>
          {chartData.length < 2 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              צריך לפחות 2 בדיקות כדי להציג גרף.
            </div>
          ) : (
            <div className="rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.02 220)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ direction: "rtl", fontSize: 12, borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="pH" stroke="oklch(0.58 0.16 230)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="כלור" stroke="oklch(0.65 0.15 155)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="אלקליניות" stroke="oklch(0.75 0.16 70)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* History */}
        <section className="mt-6">
          <h2 className="mb-3 text-base font-bold text-foreground">היסטוריית בדיקות</h2>
          {tests.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">אין בדיקות עדיין.</p>
          ) : (
            <div className="space-y-2">
              {tests.map((t) => (
                <Link key={t.id} to="/results/$testId" params={{ testId: t.id }}
                  className="block rounded-2xl bg-card p-3 shadow-[var(--shadow-card)] transition active:scale-[0.99]">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                    <div className="flex gap-3 text-xs">
                      {t.results.readings.ph && (
                        <span><span className="text-muted-foreground">pH</span> <b>{t.results.readings.ph.value}</b></span>
                      )}
                      {t.results.readings.freeChlorine && (
                        <span><span className="text-muted-foreground">Cl</span> <b>{t.results.readings.freeChlorine.value}</b></span>
                      )}
                      {t.results.readings.alkalinity && (
                        <span><span className="text-muted-foreground">TA</span> <b>{t.results.readings.alkalinity.value}</b></span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
