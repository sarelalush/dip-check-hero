import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Sparkles,
  Crop,
  X,
} from "lucide-react";
import { scanSession } from "@/utils/scanSession";
import {
  analyzeStripImage,
  StripNotDetectedError,
  type FailureReason,
} from "@/utils/analyzeStripImage";
import { getBrand } from "@/config/stripBrands";
import { cropToWhite } from "@/utils/cropToWhite";

export const Route = createFileRoute("/scan-confirm")({
  head: () => ({ meta: [{ title: "אישור תמונה — PoolCheck" }] }),
  component: ScanConfirmScreen,
});

function ScanConfirmScreen() {
  const navigate = useNavigate();
  const [pending, setPending] = useState<string | undefined>(undefined);
  const [original, setOriginal] = useState<string | undefined>(undefined);
  const [cropping, setCropping] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<{ reason: FailureReason; message: string } | null>(null);

  useEffect(() => {
    const sess = scanSession.get();
    if (!sess.pendingImageDataUrl) {
      navigate({ to: "/scan" });
      return;
    }
    setPending(sess.pendingImageDataUrl);
    setOriginal(sess.pendingOriginalDataUrl);
  }, [navigate]);

  async function handleConfirm() {
    if (!pending) return;
    setAnalyzing(true);
    setError(null);
    try {
      const sess = scanSession.get();
      const results = await analyzeStripImage(pending, sess.brandId);
      scanSession.set({
        results,
        imageDataUrl: pending,
        pendingImageDataUrl: undefined,
        pendingOriginalDataUrl: undefined,
      });
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
    scanSession.set({ pendingImageDataUrl: undefined, pendingOriginalDataUrl: undefined });
    navigate({ to: "/scan" });
  }

  async function handleApplyCrop(rect: { x: number; y: number; w: number; h: number }) {
    if (!original) return;
    try {
      const cropped = await cropToWhite(original, rect);
      scanSession.set({ pendingImageDataUrl: cropped });
      setPending(cropped);
      setCropping(false);
      setError(null);
    } catch (e) {
      console.error(e);
    }
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

        {/* Manual crop encouragement */}
        {original && (
          <div className="mt-4">
            <p className="mb-2 text-center text-sm font-semibold text-foreground">
              💡 לתוצאה מדויקת יותר — כוון ידנית את החיתוך על הריבועים
            </p>
            <button
              onClick={() => setCropping(true)}
              disabled={analyzing}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-60"
            >
              <Crop className="h-5 w-5" />
              פתח כלי חיתוך ידני
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-[10px] font-bold">
                מומלץ
              </span>
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              ככל שהחיתוך מדויק יותר על הריבועים הצבעוניים — התוצאה מדויקת יותר ✨
            </p>
          </div>
        )}

        {/* Checklist */}
        <div className="mt-4 rounded-2xl border border-border/60 bg-card p-4 text-sm text-foreground">
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

      {cropping && original && (
        <ManualCropper
          src={original}
          onCancel={() => setCropping(false)}
          onApply={handleApplyCrop}
        />
      )}
    </div>
  );
}

type Handle = "move" | "tl" | "tr" | "bl" | "br";

interface CropperProps {
  src: string;
  onCancel: () => void;
  onApply: (rect: { x: number; y: number; w: number; h: number }) => void;
}

function ManualCropper({ src, onCancel, onApply }: CropperProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  // Image draw rect inside wrap (pixels), once image loads.
  const [imgBox, setImgBox] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );
  // Crop rect in pixel coords relative to wrap.
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragRef = useRef<{
    handle: Handle;
    startX: number;
    startY: number;
    orig: { x: number; y: number; w: number; h: number };
  } | null>(null);

  function recompute() {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img || !img.naturalWidth) return;
    const wrapW = wrap.clientWidth;
    const wrapH = wrap.clientHeight;
    const scale = Math.min(wrapW / img.naturalWidth, wrapH / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const x = (wrapW - drawW) / 2;
    const y = (wrapH - drawH) / 2;
    setImgBox({ x, y, w: drawW, h: drawH });
    setRect((prev) => {
      if (prev) return prev;
      // Default crop: ~middle 40% width, 70% height of the image area.
      const cw = drawW * 0.45;
      const ch = drawH * 0.75;
      return {
        x: x + (drawW - cw) / 2,
        y: y + (drawH - ch) / 2,
        w: cw,
        h: ch,
      };
    });
  }

  useEffect(() => {
    const onResize = () => recompute();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function startDrag(e: React.PointerEvent, handle: Handle) {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: { ...rect },
    };
  }

  function onMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (!d || !rect || !imgBox) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const minSize = 40;
    const left = imgBox.x;
    const top = imgBox.y;
    const right = imgBox.x + imgBox.w;
    const bottom = imgBox.y + imgBox.h;

    let { x, y, w, h } = d.orig;
    if (d.handle === "move") {
      x = Math.max(left, Math.min(right - w, x + dx));
      y = Math.max(top, Math.min(bottom - h, y + dy));
    } else {
      let x2 = x + w;
      let y2 = y + h;
      if (d.handle === "tl") {
        x = Math.max(left, Math.min(x2 - minSize, x + dx));
        y = Math.max(top, Math.min(y2 - minSize, y + dy));
      } else if (d.handle === "tr") {
        x2 = Math.min(right, Math.max(x + minSize, x2 + dx));
        y = Math.max(top, Math.min(y2 - minSize, y + dy));
      } else if (d.handle === "bl") {
        x = Math.max(left, Math.min(x2 - minSize, x + dx));
        y2 = Math.min(bottom, Math.max(y + minSize, y2 + dy));
      } else if (d.handle === "br") {
        x2 = Math.min(right, Math.max(x + minSize, x2 + dx));
        y2 = Math.min(bottom, Math.max(y + minSize, y2 + dy));
      }
      w = x2 - x;
      h = y2 - y;
    }
    setRect({ x, y, w, h });
  }

  function endDrag() {
    dragRef.current = null;
  }

  function apply() {
    if (!rect || !imgBox) return;
    const nx = (rect.x - imgBox.x) / imgBox.w;
    const ny = (rect.y - imgBox.y) / imgBox.h;
    const nw = rect.w / imgBox.w;
    const nh = rect.h / imgBox.h;
    onApply({
      x: Math.max(0, Math.min(1, nx)),
      y: Math.max(0, Math.min(1, ny)),
      w: Math.max(0.01, Math.min(1, nw)),
      h: Math.max(0.01, Math.min(1, nh)),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white" dir="rtl">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <button
          onClick={onCancel}
          className="rounded-full bg-white/10 p-2 backdrop-blur active:scale-95"
          aria-label="ביטול"
        >
          <X className="h-5 w-5" />
        </button>
        <span className="text-sm font-bold">סמן את אזור הסטיק</span>
        <span className="w-9" />
      </div>

      <div
        ref={wrapRef}
        className="relative flex-1 touch-none select-none overflow-hidden"
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <img
          ref={imgRef}
          src={src}
          alt="תמונה מקורית"
          onLoad={recompute}
          className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain"
          draggable={false}
        />

        {imgBox && rect && (
          <>
            {/* Dim overlay outside the crop rect using box-shadow trick */}
            <div
              className="absolute border-2 border-primary"
              style={{
                left: rect.x,
                top: rect.y,
                width: rect.w,
                height: rect.h,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
              }}
              onPointerDown={(e) => startDrag(e, "move")}
            >
              {/* Grid lines */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
                <div className="absolute top-1/3 left-0 h-px w-full bg-white/30" />
                <div className="absolute top-2/3 left-0 h-px w-full bg-white/30" />
              </div>
              {/* Corner handles */}
              {(["tl", "tr", "bl", "br"] as const).map((h) => (
                <div
                  key={h}
                  onPointerDown={(e) => startDrag(e, h)}
                  className="absolute h-7 w-7 rounded-full border-2 border-primary bg-white"
                  style={{
                    left: h.endsWith("l") ? -14 : "auto",
                    right: h.endsWith("r") ? -14 : "auto",
                    top: h.startsWith("t") ? -14 : "auto",
                    bottom: h.startsWith("b") ? -14 : "auto",
                    touchAction: "none",
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-3">
        <button
          onClick={onCancel}
          className="flex-1 rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-semibold backdrop-blur active:scale-[0.98]"
        >
          ביטול
        </button>
        <button
          onClick={apply}
          className="flex-[2] rounded-2xl bg-primary px-4 py-3 text-base font-bold text-primary-foreground shadow-[var(--shadow-soft)] active:scale-[0.98]"
        >
          אישור החיתוך
        </button>
      </div>
    </div>
  );
}
