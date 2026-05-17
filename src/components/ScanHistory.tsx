import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

export interface TestRow {
  id: string;
  user_id: string;
  pool_id: string;
  tested_at: string;
  image_url: string | null;
  results: unknown;
  recommendations: unknown;
}
export interface PoolRow {
  id: string;
  user_id: string;
  name: string;
}

interface Reading {
  unit?: string;
  value?: number;
  status?: "ok" | "low" | "high" | string;
  labelHe?: string;
}
interface Recommendation {
  labelHe?: string;
  actionHe?: string;
  status?: string;
  measured?: number;
  target?: number;
  unit?: string;
}

const statusStyles: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  low: "bg-amber-100 text-amber-700 border-amber-200",
  high: "bg-rose-100 text-rose-700 border-rose-200",
};
const statusLabel: Record<string, string> = {
  ok: "תקין",
  low: "נמוך",
  high: "גבוה",
};

const PARAM_META: { key: string; labelHe: string; color: string; unit: string; idealMin?: number; idealMax?: number }[] = [
  { key: "ph", labelHe: "pH", color: "hsl(220 85% 58%)", unit: "", idealMin: 7.2, idealMax: 7.6 },
  { key: "freeChlorine", labelHe: "כלור חופשי", color: "hsl(140 65% 45%)", unit: "ppm", idealMin: 1, idealMax: 3 },
  { key: "totalChlorine", labelHe: "כלור כולל", color: "hsl(170 60% 45%)", unit: "ppm", idealMin: 1, idealMax: 3 },
  { key: "alkalinity", labelHe: "אלקליניות", color: "hsl(30 85% 55%)", unit: "ppm", idealMin: 80, idealMax: 120 },
  { key: "bromine", labelHe: "ברום", color: "hsl(320 65% 55%)", unit: "ppm", idealMin: 2, idealMax: 4 },
];

export function ScanReport({ results, recommendations }: { results: unknown; recommendations: unknown }) {
  const r = (results ?? {}) as { readings?: Record<string, Reading>; confidence?: number; brandId?: string; source?: string };
  const readings = r.readings ?? {};
  const recs = (Array.isArray(recommendations) ? recommendations : []) as Recommendation[];
  const readingEntries = Object.entries(readings);

  return (
    <div className="mt-3 space-y-3">
      {readingEntries.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-bold text-muted-foreground">תוצאות מדידה</div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {readingEntries.map(([key, v]) => {
              const status = String(v.status ?? "ok");
              return (
                <div key={key} className="rounded-lg border border-border bg-card px-2.5 py-2">
                  <div className="text-[10px] text-muted-foreground">{v.labelHe ?? key}</div>
                  <div className="mt-0.5 flex items-baseline gap-1">
                    <span className="text-sm font-bold text-foreground">{v.value ?? "—"}</span>
                    {v.unit && <span className="text-[10px] text-muted-foreground">{v.unit}</span>}
                  </div>
                  <span className={`mt-1 inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusStyles[status] ?? statusStyles.ok}`}>
                    {statusLabel[status] ?? status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {recs.length > 0 && (
        <div>
          <div className="mb-1.5 text-xs font-bold text-muted-foreground">המלצות טיפול</div>
          <div className="space-y-1.5">
            {recs.map((rec, i) => {
              const status = String(rec.status ?? "ok");
              return (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card px-2.5 py-2">
                  <span className={`mt-0.5 shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${statusStyles[status] ?? statusStyles.ok}`}>
                    {statusLabel[status] ?? status}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-foreground">{rec.labelHe}</div>
                    <div className="text-[11px] text-muted-foreground">{rec.actionHe}</div>
                    {(rec.measured !== undefined || rec.target !== undefined) && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        נמדד: {rec.measured ?? "—"}{rec.unit ? ` ${rec.unit}` : ""} · יעד: {rec.target ?? "—"}{rec.unit ? ` ${rec.unit}` : ""}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(r.confidence !== undefined || r.brandId) && (
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          {r.brandId && <span>ערכה: {r.brandId}</span>}
          {r.confidence !== undefined && <span>· ביטחון: {Math.round((r.confidence ?? 0) * 100)}%</span>}
          {r.source && <span>· מקור: {r.source}</span>}
        </div>
      )}
    </div>
  );
}

export function TestItem({ test, poolName, defaultOpen = false }: { test: TestRow; poolName: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !test.image_url || signedUrl) return;
    let cancelled = false;
    (async () => {
      if (test.image_url!.startsWith("http") || test.image_url!.startsWith("data:")) {
        if (!cancelled) setSignedUrl(test.image_url);
        return;
      }
      const { data, error } = await supabase.storage
        .from("scan-images")
        .createSignedUrl(test.image_url!, 60 * 60);
      if (cancelled) return;
      if (error || !data?.signedUrl) {
        setImgError(error?.message ?? "לא נמצאה תמונה");
      } else {
        setSignedUrl(data.signedUrl);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, test.image_url, signedUrl]);

  const date = new Date(test.tested_at);
  const dateStr = date.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  const timeStr = date.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-right transition hover:bg-muted/50"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {test.image_url && <ImageIcon className="h-3.5 w-3.5" />}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-foreground">{dateStr} · {timeStr}</div>
          <div className="text-[11px] text-muted-foreground truncate">בריכה: {poolName}</div>
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-background/60 px-3 py-3">
          {test.image_url ? (
            signedUrl ? (
              <img
                src={signedUrl}
                alt="תמונת סריקה"
                className="mb-3 max-h-72 w-full rounded-lg border border-border bg-white object-contain"
              />
            ) : imgError ? (
              <div className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                לא ניתן לטעון תמונה: {imgError}
              </div>
            ) : (
              <div className="mb-3 flex h-32 items-center justify-center rounded-lg border border-border bg-muted/40">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )
          ) : (
            <div className="mb-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-center text-xs text-muted-foreground">
              לא נשמרה תמונה לסריקה זו
            </div>
          )}
          <ScanReport results={test.results} recommendations={test.recommendations} />
        </div>
      )}
    </div>
  );
}

export function MySection({
  userId,
  tests,
  pools,
  poolName,
  title = "הסריקות שלי",
}: {
  userId: string;
  tests: TestRow[];
  pools: PoolRow[];
  poolName: Map<string, string>;
  title?: string;
}) {
  const myTests = useMemo(
    () => tests.filter((t) => t.user_id === userId).sort((a, b) => +new Date(b.tested_at) - +new Date(a.tested_at)),
    [tests, userId],
  );
  const myPools = useMemo(() => pools.filter((p) => p.user_id === userId), [pools, userId]);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<string>("");

  useEffect(() => {
    if (!selectedPool && myPools.length > 0) setSelectedPool(myPools[0].id);
  }, [myPools, selectedPool]);

  const chartData = useMemo(() => {
    if (!selectedPool) return [];
    return myTests
      .filter((t) => t.pool_id === selectedPool)
      .slice()
      .sort((a, b) => +new Date(a.tested_at) - +new Date(b.tested_at))
      .map((t) => {
        const r = (t.results ?? {}) as { readings?: Record<string, { value?: number }> };
        const readings = r.readings ?? {};
        const row: Record<string, number | string> = {
          date: new Date(t.tested_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" }),
        };
        for (const p of PARAM_META) {
          const v = readings[p.key]?.value;
          if (typeof v === "number") row[p.key] = v;
        }
        return row;
      });
  }, [myTests, selectedPool]);

  const activeParams = useMemo(
    () => PARAM_META.filter((p) => chartData.some((d) => typeof d[p.key] === "number")),
    [chartData],
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-extrabold text-foreground">{title}</h2>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
            {myTests.length}
          </span>
        </div>
        {myTests.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">עדיין לא בוצעו סריקות.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-muted/20 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-semibold">תאריך</th>
                  <th className="px-4 py-2 font-semibold">בריכה</th>
                  <th className="px-4 py-2 font-semibold">תמונה</th>
                  <th className="px-4 py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {myTests.map((t) => {
                  const isOpen = expandedTest === t.id;
                  const d = new Date(t.tested_at);
                  return (
                    <Fragment key={t.id}>
                      <tr className="border-t border-border hover:bg-muted/20">
                        <td className="px-4 py-2.5 align-middle">
                          <div className="font-semibold text-foreground">
                            {d.toLocaleDateString("he-IL")}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 align-middle text-foreground">
                          {poolName.get(t.pool_id) ?? "—"}
                        </td>
                        <td className="px-4 py-2.5 align-middle text-muted-foreground">
                          {t.image_url ? <ImageIcon className="h-4 w-4 text-primary" /> : "—"}
                        </td>
                        <td className="px-4 py-2.5 align-middle">
                          <button
                            onClick={() => setExpandedTest(isOpen ? null : t.id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90"
                          >
                            {isOpen ? "סגור" : "פתח דוח"}
                            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-muted/20">
                          <td colSpan={4} className="px-4 py-3">
                            <TestItem test={t} poolName={poolName.get(t.pool_id) ?? "—"} defaultOpen />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-extrabold text-foreground">מגמת נתוני סריקות</h2>
          </div>
          {myPools.length > 0 && (
            <select
              value={selectedPool}
              onChange={(e) => setSelectedPool(e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground"
            >
              {myPools.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="p-4">
          {myPools.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין בריכות.</div>
          ) : chartData.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין סריקות לבריכה זו.</div>
          ) : chartData.length === 1 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              צריך לפחות 2 סריקות כדי להציג מגמה. יש כרגע סריקה אחת.
            </div>
          ) : (
            <div dir="ltr" className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--card))",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {activeParams.map((p) => (
                    <Line
                      key={p.key}
                      type="monotone"
                      dataKey={p.key}
                      name={p.labelHe}
                      stroke={p.color}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
