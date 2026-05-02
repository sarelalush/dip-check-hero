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
      const results = await analyzeStripImage(dataUrl, true);
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
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        <h1 className="text-2xl font-extrabold text-foreground">סריקת סטיק בדיקה</h1>
        <p className="mt-1 text-sm text-muted-foreground">צלם או העלה תמונה של הסטיק שלך</p>

        {/* Strip frame illustration */}
        <div className="mt-6 rounded-3xl bg-[var(--gradient-card)] p-6 shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-48 w-20 flex-col overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-secondary">
            {["#FFE066", "#FF8C42", "#E63946", "#A8DADC", "#457B9D"].map((c) => (
              <div key={c} className="flex-1" style={{ backgroundColor: c }} />
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">מקם את הסטיק במרכז המסגרת</p>
        </div>

        {/* Tips */}
        <div className="mt-6 space-y-2">
          <Tip icon={<Sun className="h-4 w-4" />} text="צלם באור טוב" />
          <Tip icon={<Square className="h-4 w-4" />} text="הנח על רקע בהיר" />
          <Tip icon={<Eye className="h-4 w-4" />} text="ודא שכל הריבועים הצבעוניים נראים בבירור" />
        </div>

        {/* Buttons */}
        <div className="mt-6 space-y-3">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden
                 onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <input ref={galleryRef} type="file" accept="image/*" hidden
                 onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />

          <button
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : <Camera className="h-6 w-6" />}
            {loading ? "מנתח את הסטיק..." : "צלם סטיק"}
          </button>
          <button
            disabled={loading}
            onClick={() => galleryRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card px-6 py-4 text-base font-semibold text-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            <ImageIcon className="h-5 w-5 text-primary" />
            העלה מהגלריה
          </button>
          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive text-center">
              {error}
            </div>
          )}
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
