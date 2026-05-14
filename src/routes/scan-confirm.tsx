import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { scanSession } from "@/utils/scanSession";
import {
  analyzeStripImage,
  StripNotDetectedError,
  type FailureReason,
} from "@/utils/analyzeStripImage";
import { getBrand } from "@/config/stripBrands";

export const Route = createFileRoute("/scan-confirm")({
  head: () => ({ meta: [{ title: "אישור תמונה — PoolCheck" }] }),
  component: ScanConfirmScreen,
});

function ScanConfirmScreen() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | undefined>(undefined);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<{ reason: FailureReason; message: string } | null>(null);

  useEffect(() => {
    const sess = scanSession.get();
    if (!sess.pendingImageDataUrl) {
      // Nothing to confirm — back to scan
      navigate({ to: "/scan" });
      return;
    }
    setPending(sess.pendingImageDataUrl);
  }, [navigate]);

  async function handleConfirm() {
    if (!pending) return;
    setAnalyzing(true);
    setError(null);
    try {
      const sess = scanSession.get();
      const results = await analyzeStripImage(pending, sess.brandId);
      scanSession.set({ results, imageDataUrl: pending, pendingImageDataUrl: undefined });
      navigate({ to: "/select-pool" });
    } catch (e) {
      console.error(e);
      if (e instanceof StripNotDetectedError) {
        setError({ reason: e.reason, message: e.message });
      } else {
        setError({
          reason: "unknown",
          message: e instanceof Error ? e.message : "שגיאה בניתוח התמונה.",
        });
      }
      setAnalyzing(false);
    }
  }

  function handleRetake() {
    scanSession.set({ pendingImageDataUrl: undefined });
    navigate({ to: "/scan" });
  }

  const brandName = getBrand(scanSession.get().brandId).nameHe;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link
          to="/scan"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> חזרה לצילום
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">
              לוודא שהצבעים נראים נכון
            </h1>
            <p className="text-sm text-muted-foreground">
              {brandName} — חתכנו את הסטיק והנחנו על רקע לבן
            </p>
          </div>
        </div>

        {/* Image preview */}
        <div
          className="relative mt-6 overflow-hidden rounded-3xl p-3 shadow-[var(--shadow-card)]"
          style={{ background: "var(--gradient-card)" }}
        >
          {pending ? (
            <img
              src={pending}
              alt="הסטיק שצולם"
              className="mx-auto block w-full max-w-xs rounded-2xl bg-white"
            />
          ) : (
            <div className="flex h-72 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="mt-5 rounded-2xl border border-border/60 bg-card p-4 text-sm text-foreground">
          <div className="font-bold mb-2">לפני שממשיכים, בדוק:</div>
          <ul className="space-y-1.5 list-disc pr-5 text-muted-foreground">
            <li>כל הריבועים הצבעוניים נראים בבירור</li>
            <li>הצבעים תואמים את מה שאתה רואה בסטיק האמיתי</li>
            <li>אין בוהק / השתקפות חזקה על הריבועים</li>
          </ul>
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-right">
            <div className="flex items-center gap-2 text-destructive font-bold">
              <AlertTriangle className="h-5 w-5" />
              <span>הניתוח נכשל</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{error.message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={handleConfirm}
            disabled={analyzing || !pending}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {analyzing ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Check className="h-6 w-6" />
            )}
            {analyzing ? "מנתח את הסטיק..." : "הצבעים נראים טוב — המשך"}
          </button>
          <button
            onClick={handleRetake}
            disabled={analyzing}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card px-6 py-4 text-base font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            <RotateCcw className="h-5 w-5 text-primary" />
            צלם שוב
          </button>
        </div>
      </div>
    </div>
  );
}
