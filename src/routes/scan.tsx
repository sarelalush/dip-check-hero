import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Camera, Image as ImageIcon, ArrowRight, Loader2, Sun, Square, Eye, AlertTriangle } from "lucide-react";
import { analyzeStripImage, StripNotDetectedError, type FailureReason } from "@/utils/analyzeStripImage";
import { scanSession } from "@/utils/scanSession";

export const Route = createFileRoute("/scan")({
  head: () => ({ meta: [{ title: "סריקת סטיק — PoolCheck" }] }),
  component: ScanScreen,
});

function ScanScreen() {
  const navigate = useNavigate();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<{ reason: FailureReason; message: string } | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setFailure(null);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res) => {
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(file);
      });
      const results = await analyzeStripImage(dataUrl, scanSession.get().brandId);
      scanSession.set({ results, imageDataUrl: dataUrl });
      navigate({ to: "/select-pool" });
    } catch (e) {
      console.error(e);
      if (e instanceof StripNotDetectedError) {
        setFailure({ reason: e.reason, message: e.message });
      } else {
        setFailure({
          reason: "unknown",
          message: e instanceof Error ? e.message : "שגיאה בניתוח התמונה.",
        });
      }
      setLoading(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">סריקת סטיק בדיקה</h1>
            <p className="text-sm text-muted-foreground">צלם או העלה תמונה של הסטיק שלך</p>
          </div>
        </div>

        {/* Strip frame illustration */}
        <div
          className="relative mt-6 overflow-hidden rounded-3xl p-7 shadow-[var(--shadow-card)]"
          style={{ background: "var(--gradient-card)" }}
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-cyan-200/40 blur-2xl" />

          <div className="relative mx-auto flex h-52 w-24 animate-float-slow flex-col overflow-hidden rounded-2xl border-2 border-dashed border-primary/40 bg-secondary shadow-lg ring-4 ring-primary/5">
            {["#FFE066", "#FF8C42", "#E63946", "#A8DADC", "#457B9D"].map((c) => (
              <div key={c} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <p className="relative mt-4 text-center text-xs font-medium text-muted-foreground">
            מקם את הסטיק במרכז המסגרת
          </p>
        </div>

        {/* Tips */}
        <div className="mt-6 grid grid-cols-3 gap-2">
          <Tip icon={<Sun className="h-4 w-4" />} text="אור טוב" />
          <Tip icon={<Square className="h-4 w-4" />} text="רקע בהיר" />
          <Tip icon={<Eye className="h-4 w-4" />} text="כל הריבועים" />
        </div>

        {/* Buttons */}
        <div className="mt-6 space-y-3">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
                 onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden
                 onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <Link
            to="/scan-live"
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
          >
            <Camera className="h-6 w-6" />
            סריקת לייב (מומלץ)
          </Link>
          <button
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card px-6 py-4 text-base font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            {loading ? "מנתח את הסטיק..." : "צלם תמונה רגילה"}
          </button>
          <button
            disabled={loading}
            onClick={() => galleryRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card px-6 py-4 text-base font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            <ImageIcon className="h-5 w-5 text-primary" />
            העלה מהגלריה
          </button>
          {failure && <FailureCard reason={failure.reason} message={failure.message} />}
        </div>
      </div>
    </div>
  );
}

function Tip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm text-foreground">
      <span className="text-primary">{icon}</span> {text}
    </div>
  );
}

const FAILURE_GUIDE: Record<FailureReason, { title: string; tips: string[] }> = {
  not_strip: {
    title: "לא זוהה סטיק בדיקה בתמונה",
    tips: [
      "ודא שאתה מצלם סטיק בדיקה לבריכה (AquaChek או דומה)",
      "הסטיק צריך להופיע במרכז התמונה ולמלא את רובה",
      "הסר אובייקטים אחרים מהפריים",
    ],
  },
  blurry: {
    title: "התמונה מטושטשת",
    tips: [
      "ייצב את היד או הנח את הטלפון על משטח",
      "המתן שהמצלמה תתמקד לפני הצילום",
      "התקרב לסטיק במקום להשתמש בזום",
    ],
  },
  lighting: {
    title: "תאורה לא טובה",
    tips: [
      "צלם באור יום טבעי, לא באור מנורה צהוב",
      "הימנע מצל ישיר על הסטיק",
      "הימנע מבוהק / השתקפות על הריבועים הצבעוניים",
    ],
  },
  framing: {
    title: "מסגור התמונה",
    tips: [
      "ודא שכל הריבועים הצבעוניים נראים בתמונה",
      "התקרב — הסטיק צריך למלא את רוב הפריים",
      "החזק את הטלפון ישר מעל הסטיק (לא בזווית)",
    ],
  },
  low_confidence: {
    title: "לא הצלחנו לקרוא את הצבעים בביטחון",
    tips: [
      "צלם שוב באור טוב יותר",
      "הנח את הסטיק על רקע לבן או בהיר",
      "ודא שלא נשארו טיפות מים גדולות שמעוותות את הצבע",
    ],
  },
  ai_error: {
    title: "שגיאה זמנית בניתוח",
    tips: ["בדוק את החיבור לאינטרנט", "המתן רגע ונסה שוב"],
  },
  unknown: {
    title: "משהו השתבש",
    tips: ["נסה לצלם שוב באור טוב, עם הסטיק במרכז התמונה"],
  },
};

function FailureCard({ reason, message }: { reason: FailureReason; message: string }) {
  const guide = FAILURE_GUIDE[reason] ?? FAILURE_GUIDE.unknown;
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-right">
      <div className="flex items-center gap-2 text-destructive font-bold">
        <AlertTriangle className="h-5 w-5" />
        <span>{guide.title}</span>
      </div>
      {message && message !== guide.title && (
        <p className="mt-1 text-xs text-muted-foreground">{message}</p>
      )}
      <ul className="mt-3 space-y-1.5 text-sm text-foreground list-disc pr-5">
        {guide.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
      <p className="mt-3 text-xs font-semibold text-primary">תקן את הבעיה ונסה לצלם שוב</p>
    </div>
  );
}
