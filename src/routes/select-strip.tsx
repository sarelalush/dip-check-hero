import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Camera, Check, ChevronLeft, Loader2, Plus, Send } from "lucide-react";
import { STRIP_BRANDS, type StripBrand } from "@/config/stripBrands";
import { getBrandSwatches, type ParamSwatches } from "@/config/brandSwatches";
import { scanSession } from "@/utils/scanSession";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/select-strip")({
  head: () => ({ meta: [{ title: "בחירת סטיק בדיקה — AquaSense" }] }),
  component: SelectStripScreen,
});

type Step = "list" | "preview" | "request";

function SelectStripScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("list");
  const [brand, setBrand] = useState<StripBrand | null>(null);

  // Pre-select previously chosen brand if any
  useEffect(() => {
    const prev = scanSession.get().brandId;
    if (prev) {
      const b = STRIP_BRANDS.find((x) => x.id === prev);
      if (b) setBrand(b);
    }
  }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <BackLink step={step} onBack={() => setStep("list")} />

        {step === "list" && (
          <BrandList
            selected={brand}
            onPick={(b) => { setBrand(b); setStep("preview"); }}
            onRequest={() => setStep("request")}
          />
        )}

        {step === "preview" && brand && (
          <BrandPreview
            brand={brand}
            onConfirm={() => {
              scanSession.set({ brandId: brand.id });
              navigate({ to: "/scan" });
            }}
            onChange={() => setStep("list")}
          />
        )}

        {step === "request" && (
          <RequestForm onDone={() => setStep("list")} />
        )}
      </div>
    </div>
  );
}

function BackLink({ step, onBack }: { step: Step; onBack: () => void }) {
  if (step === "list") {
    return (
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground">
        <ArrowRight className="h-4 w-4" /> חזרה
      </Link>
    );
  }
  return (
    <button onClick={onBack} className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground">
      <ArrowRight className="h-4 w-4" /> חזרה לרשימה
    </button>
  );
}

/* ---------- Step 1: brand list ---------- */

function BrandList({
  selected,
  onPick,
  onRequest,
}: {
  selected: StripBrand | null;
  onPick: (b: StripBrand) => void;
  onRequest: () => void;
}) {
  return (
    <>
      <div
        className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-soft)]"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="pointer-events-none absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <div className="text-[11px] font-semibold tracking-[0.22em] text-white/80">שלב 1 מתוך 2</div>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">באיזה סטיק אתה משתמש?</h1>
        <p className="mt-1 text-sm text-white/85">בחר את החברה כדי שנוכל להתאים את הצבעים בדיוק.</p>
      </div>

      <div className="mt-5 space-y-3">
        {STRIP_BRANDS.map((b) => (
          <button
            key={b.id}
            onClick={() => onPick(b)}
            className={`flex w-full items-start gap-3 rounded-2xl border bg-card p-4 text-right shadow-sm transition active:scale-[0.99] hover:border-primary/40 ${
              selected?.id === b.id ? "border-primary/60 ring-2 ring-primary/20" : "border-border/60"
            }`}
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
              {b.parameters.length}
            </div>
            <div className="flex-1">
              <div className="font-bold text-foreground">{b.nameHe}</div>
              <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{b.descriptionHe}</div>
            </div>
            <ChevronLeft className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
          </button>
        ))}
      </div>

      <button
        onClick={onRequest}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-6 py-4 font-semibold text-primary transition hover:bg-primary/10 active:scale-[0.98]"
      >
        <Plus className="h-5 w-5" />
        הסטיק שלי לא ברשימה
      </button>
    </>
  );
}

/* ---------- Step 2: swatch preview ---------- */

function BrandPreview({
  brand,
  onConfirm,
  onChange,
}: {
  brand: StripBrand;
  onConfirm: () => void;
  onChange: () => void;
}) {
  const swatches: ParamSwatches[] = useMemo(() => getBrandSwatches(brand), [brand]);

  return (
    <>
      <div className="text-[11px] font-semibold tracking-[0.22em] text-primary">שלב 2 מתוך 2 · אישור הסטיק</div>
      <h1 className="mt-1 text-2xl font-extrabold leading-tight text-foreground">{brand.nameHe}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        השווה את מניפת הצבעים לבקבוק שיש לך ביד. אם הצבעים תואמים — אפשר להמשיך לסריקה.
      </p>

      <div className="mt-5 space-y-4">
        {swatches.map((p) => (
          <div key={p.paramKey} className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-bold text-foreground">{p.labelHe}</div>
              {p.unit && <div className="text-[11px] text-muted-foreground">{p.unit}</div>}
            </div>
            <div className="mt-3 grid grid-cols-6 gap-1.5">
              {p.swatches.map((s) => (
                <div key={`${p.paramKey}-${s.value}`} className="flex flex-col items-center gap-1">
                  <div
                    className="h-9 w-full rounded-md ring-1 ring-black/5"
                    style={{ backgroundColor: s.color }}
                    aria-label={`${p.labelHe} ${s.label}`}
                  />
                  <div className="text-[10px] font-medium text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        <button
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
        >
          <Check className="h-6 w-6" />
          זה הסטיק שלי — המשך לסריקה
          <Camera className="h-5 w-5 opacity-80" />
        </button>
        <button
          onClick={onChange}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-muted active:scale-[0.98]"
        >
          לא תואם — בחר חברה אחרת
        </button>
      </div>
    </>
  );
}

/* ---------- Step 3: request a new brand ---------- */

function RequestForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const [brandName, setBrandName] = useState("");
  const [notes, setNotes] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!brandName.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { error } = await supabase.from("strip_brand_requests").insert({
        brand_name: brandName.trim().slice(0, 120),
        notes: notes.trim().slice(0, 1000) || null,
        contact_email: email.trim() || null,
        user_id: user?.id ?? null,
      });
      if (error) throw error;
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בשליחת הבקשה");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Check className="h-7 w-7" />
        </div>
        <h2 className="mt-3 text-xl font-extrabold text-foreground">הבקשה התקבלה</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          תודה! נבחן את הסטיק שביקשת ונוסיף אותו לאפליקציה ברגע שנוכל.
        </p>
        <button
          onClick={onDone}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground shadow-[var(--shadow-soft)] active:scale-[0.98]"
        >
          חזרה לרשימת הסטיקים
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <h1 className="text-2xl font-extrabold text-foreground">בקשת הוספה של סטיק חדש</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        ספר לנו איזה סטיק אתה משתמש בו — נוסיף אותו בקרוב.
      </p>

      <div className="mt-5 space-y-3">
        <Field label="שם החברה / סטיק *">
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            maxLength={120}
            required
            placeholder="לדוגמה: Pentair Test Strips 5-in-1"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <Field label="פרטים נוספים (כמה פדים, אילו פרמטרים)">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder="לדוגמה: 5 פדים — כלור חופשי, pH, אלקליניות, חומצה ציאנורית, קשיות"
            className="w-full resize-none rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        <Field label="אימייל ליצירת קשר (אופציונלי)">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </Field>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !brandName.trim()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {submitting ? "שולח..." : "שלח בקשה"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
