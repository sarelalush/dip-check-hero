import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, X, Loader2 } from "lucide-react";
import { analyzeFrameQuality, type FrameQuality } from "@/utils/frameQuality";
import { isolateStripOnWhite } from "@/utils/isolateStrip";
import { scanSession } from "@/utils/scanSession";

export const Route = createFileRoute("/scan-live")({
  head: () => ({ meta: [{ title: "סריקת לייב — PoolCheck" }] }),
  component: LiveScanScreen,
});

const STABLE_FRAMES_NEEDED = 4; // ~2s of good frames before auto-capture

function LiveScanScreen() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stableCountRef = useRef(0);
  const capturingRef = useRef(false);
  const prevFrameRef = useRef<{
    lumaGrid: Float32Array;
    gridCols: number;
    gridRows: number;
  } | null>(null);

  const [quality, setQuality] = useState<FrameQuality | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Start camera
  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
      } catch (e) {
        console.error("camera error", e);
        setStreamError(
          "לא ניתן לגשת למצלמה. ודא שאישרת הרשאה ונסה שוב, או חזור למצב צילום רגיל.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Frame analysis loop
  useEffect(() => {
    let rafId: number | null = null;
    let lastRun = 0;
    const INTERVAL = 400; // ms

    function tick(t: number) {
      rafId = requestAnimationFrame(tick);
      if (capturingRef.current) return;
      if (t - lastRun < INTERVAL) return;
      lastRun = t;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, vw, vh);

      // ROI = central vertical strip area (matches the visual frame overlay)
      const roiW = Math.floor(vw * 0.22);
      const roiH = Math.floor(vh * 0.6);
      const roiX = Math.floor((vw - roiW) / 2);
      const roiY = Math.floor((vh - roiH) / 2);

      const q = analyzeFrameQuality(
        ctx,
        { x: roiX, y: roiY, w: roiW, h: roiH },
        prevFrameRef.current,
      );
      prevFrameRef.current = {
        lumaGrid: q.lumaGrid,
        gridCols: q.gridCols,
        gridRows: q.gridRows,
      };
      setQuality(q);

      // Any shake immediately resets the auto-capture countdown.
      if (q.issue === "shaky") {
        stableCountRef.current = 0;
      } else if (q.issue === "ok" && q.quality >= 0.65) {
        stableCountRef.current += 1;
        if (stableCountRef.current >= STABLE_FRAMES_NEEDED) {
          autoCapture();
        }
      } else {
        stableCountRef.current = 0;
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function autoCapture() {
    if (capturingRef.current) return;
    capturingRef.current = true;
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const canvas = canvasRef.current!;
      const raw = canvas.toDataURL("image/jpeg", 0.92);
      // Auto-isolate the strip on a clean white background.
      const isolated = await isolateStripOnWhite(raw).catch(() => raw);
      scanSession.set({ pendingImageDataUrl: isolated });
      // Stop camera before navigation.
      streamRef.current?.getTracks().forEach((t) => t.stop());
      navigate({ to: "/scan-confirm" });
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : "שגיאה בלכידה. ממשיך לסרוק...";
      setAnalysisError(msg);
      // Resume scanning
      stableCountRef.current = 0;
      capturingRef.current = false;
      setAnalyzing(false);
    }
  }

  function manualCapture() {
    autoCapture();
  }

  const qualityPct = Math.round((quality?.quality ?? 0) * 100);
  const meterColor =
    qualityPct >= 65
      ? "bg-emerald-500"
      : qualityPct >= 35
        ? "bg-amber-500"
        : "bg-destructive";

  return (
    <div className="fixed inset-0 bg-black text-white">
      {/* Video */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Dark overlay with cutout */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-black/45" />
        {/* Target frame */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
          style={{
            width: "22%",
            height: "60%",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
            border: `3px solid ${
              qualityPct >= 65 ? "#10b981" : qualityPct >= 35 ? "#f59e0b" : "#ef4444"
            }`,
            transition: "border-color 200ms",
          }}
        >
          {/* Corner markers */}
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <span
              key={c}
              className="absolute h-5 w-5 border-white"
              style={{
                top: c.startsWith("t") ? -2 : "auto",
                bottom: c.startsWith("b") ? -2 : "auto",
                left: c.endsWith("l") ? -2 : "auto",
                right: c.endsWith("r") ? -2 : "auto",
                borderTopWidth: c.startsWith("t") ? 3 : 0,
                borderBottomWidth: c.startsWith("b") ? 3 : 0,
                borderLeftWidth: c.endsWith("l") ? 3 : 0,
                borderRightWidth: c.endsWith("r") ? 3 : 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* Top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <Link
          to="/scan"
          className="rounded-full bg-black/50 p-2 text-white backdrop-blur"
          aria-label="סגור"
        >
          <X className="h-5 w-5" />
        </Link>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-semibold backdrop-blur">
          סריקת לייב
        </span>
        <span className="w-9" />
      </div>

      {/* Quality meter + tip */}
      <div className="absolute inset-x-0 top-16 flex flex-col items-center gap-2 px-6">
        <div className="w-full max-w-xs">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className={`h-full transition-all ${meterColor}`}
              style={{ width: `${qualityPct}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-white/70">
            <span>איכות</span>
            <span>{qualityPct}%</span>
          </div>
        </div>
      </div>

      {/* Dynamic instruction */}
      <div className="pointer-events-none absolute inset-x-0 bottom-32 flex justify-center px-6">
        <div
          className="rounded-2xl px-5 py-3 text-center text-base font-bold backdrop-blur transition-colors"
          style={{
            background:
              qualityPct >= 65 ? "rgba(16,185,129,0.85)" : "rgba(0,0,0,0.6)",
          }}
        >
          {analyzing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> מעבד את התמונה...
            </span>
          ) : (
            quality?.tipHe ?? "מקם את הסטיק במרכז המסגרת"
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-[max(env(safe-area-inset-bottom),20px)]">
        {analysisError && (
          <div className="mx-4 max-w-sm rounded-xl bg-destructive/90 px-3 py-2 text-center text-xs">
            {analysisError}
          </div>
        )}
        <button
          onClick={manualCapture}
          disabled={analyzing}
          aria-label="צלם עכשיו"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur active:scale-95 disabled:opacity-50"
        >
          <Camera className="h-7 w-7" />
        </button>
        <p className="text-[11px] text-white/70">
          המצלמה תצלם אוטומטית כשהאיכות תהיה ירוקה
        </p>
      </div>

      {/* Camera permission error */}
      {streamError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 px-6">
          <div className="max-w-sm rounded-2xl bg-card p-5 text-foreground text-right">
            <h2 className="text-lg font-bold">בעיה במצלמה</h2>
            <p className="mt-2 text-sm text-muted-foreground">{streamError}</p>
            <Link
              to="/scan"
              className="mt-4 flex items-center justify-center gap-1 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
            >
              <ArrowRight className="h-4 w-4" /> חזרה לצילום רגיל
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
