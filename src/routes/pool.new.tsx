import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { poolStorage, newId, type PoolType } from "@/utils/storage";
import { calculatePoolVolume, type PoolShape } from "@/utils/calculatePoolVolume";
import { scanSession } from "@/utils/scanSession";
import { calculateDosage } from "@/utils/calculateDosage";
import { testStorage } from "@/utils/storage";
import { z } from "zod";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { PaywallCard } from "@/components/PaywallCard";

const searchSchema = z.object({ continueScan: z.coerce.number().optional() });

export const Route = createFileRoute("/pool/new")({
  head: () => ({ meta: [{ title: "בריכה חדשה — PoolCheck" }] }),
  validateSearch: (s) => searchSchema.parse(s),
  component: PoolFormScreen,
});

type Method = "manual" | "dimensions";
type Unit = "liters" | "cubic";

function PoolFormScreen() {
  const navigate = useNavigate();
  const { continueScan } = Route.useSearch();
  const { isAuthenticated, isGuest } = useAuth();
  const { allowedPools, loading: subLoading } = useSubscription();
  const existingCount = typeof window !== "undefined" ? poolStorage.list().length : 0;

  const blocked: "guest" | "pool-limit" | null =
    !isAuthenticated || isGuest
      ? "guest"
      : !subLoading && existingCount >= allowedPools
      ? "pool-limit"
      : null;

  const [name, setName] = useState("");
  const [type, setType] = useState<PoolType>("chlorine");
  const [method, setMethod] = useState<Method>("manual");
  const [unit, setUnit] = useState<Unit>("liters");
  const [manualVal, setManualVal] = useState("");
  const [shape, setShape] = useState<PoolShape>("rectangle");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [diameter, setDiameter] = useState("");
  const [depth, setDepth] = useState("");

  if (blocked) {
    return (
      <div dir="rtl" className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-5 pt-6 pb-10">
          <Link to="/pools" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
            <ArrowRight className="h-4 w-4" /> חזרה
          </Link>
          <PaywallCard reason={blocked} allowedPools={allowedPools} />
        </div>
      </div>
    );
  }

  function computeVolume(): number {
    if (method === "manual") {
      const v = parseFloat(manualVal) || 0;
      return unit === "liters" ? v : v * 1000;
    }
    const d = parseFloat(depth) || 0;
    if (shape === "rectangle") return calculatePoolVolume({ shape, length: +length || 0, width: +width || 0, depth: d });
    if (shape === "round") return calculatePoolVolume({ shape, diameter: +diameter || 0, depth: d });
    return calculatePoolVolume({ shape: "oval", length: +length || 0, width: +width || 0, depth: d });
  }

  function save() {
    const volumeLiters = computeVolume();
    if (!name.trim() || volumeLiters <= 0) return;
    const pool = {
      id: newId(),
      name: name.trim(),
      type,
      volumeLiters,
      createdAt: Date.now(),
    };
    poolStorage.save(pool);

    const sess = scanSession.get();
    if (continueScan && sess.results) {
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
    } else {
      navigate({ to: "/pools" });
    }
  }

  const previewVolume = computeVolume();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to={continueScan ? "/select-pool" : "/pools"} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>
        <h1 className="text-2xl font-extrabold text-foreground">בריכה חדשה</h1>

        <div className="mt-6 space-y-5">
          <Field label="שם הבריכה">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="למשל: הבריכה בבית"
                   className="w-full rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-primary" />
          </Field>

          <Field label="סוג בריכה">
            <ToggleGroup
              value={type}
              onChange={(v) => setType(v as PoolType)}
              options={[{ v: "chlorine", l: "כלור רגיל" }, { v: "salt", l: "בריכת מלח" }]}
            />
          </Field>

          <Field label="הזנת נפח">
            <ToggleGroup
              value={method}
              onChange={(v) => setMethod(v as Method)}
              options={[{ v: "manual", l: "ידני" }, { v: "dimensions", l: "לפי מידות" }]}
            />
          </Field>

          {method === "manual" ? (
            <div className="space-y-3">
              <ToggleGroup
                value={unit}
                onChange={(v) => setUnit(v as Unit)}
                options={[{ v: "liters", l: "ליטרים" }, { v: "cubic", l: "קוב (מ״ק)" }]}
              />
              <input value={manualVal} onChange={(e) => setManualVal(e.target.value)} type="number" inputMode="decimal"
                     placeholder={unit === "liters" ? "למשל: 12000" : "למשל: 12"}
                     className="w-full rounded-xl border border-input bg-card px-4 py-3 text-foreground outline-none focus:border-primary" />
            </div>
          ) : (
            <div className="space-y-3">
              <ToggleGroup
                value={shape}
                onChange={(v) => setShape(v as PoolShape)}
                options={[{ v: "rectangle", l: "מלבנית" }, { v: "round", l: "עגולה" }, { v: "oval", l: "אובלית" }]}
              />
              <div className="grid grid-cols-2 gap-3">
                {shape === "round" ? (
                  <NumInput label="קוטר (מ׳)" value={diameter} onChange={setDiameter} />
                ) : (
                  <>
                    <NumInput label="אורך (מ׳)" value={length} onChange={setLength} />
                    <NumInput label="רוחב (מ׳)" value={width} onChange={setWidth} />
                  </>
                )}
                <NumInput label="עומק ממוצע (מ׳)" value={depth} onChange={setDepth} />
              </div>
            </div>
          )}

          {previewVolume > 0 && (
            <div className="rounded-2xl bg-primary/10 px-4 py-3 text-center">
              <div className="text-xs text-muted-foreground">נפח משוער</div>
              <div className="text-xl font-bold text-primary">{previewVolume.toLocaleString("he-IL")} ליטר</div>
            </div>
          )}

          <button
            onClick={save}
            disabled={!name.trim() || previewVolume <= 0}
            className="w-full rounded-2xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-50"
          >
            שמור בריכה והמשך
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-foreground mb-2">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)}
             className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-foreground outline-none focus:border-primary" />
    </div>
  );
}

function ToggleGroup({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[];
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button key={o.v} onClick={() => onChange(o.v)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                  value === o.v
                    ? "bg-primary text-primary-foreground border-primary shadow-[var(--shadow-soft)]"
                    : "bg-card text-foreground border-input"
                }`}>
          {o.l}
        </button>
      ))}
    </div>
  );
}
