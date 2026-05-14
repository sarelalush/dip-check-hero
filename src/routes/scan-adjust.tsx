import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Loader2, Move } from "lucide-react";
import { scanSession } from "@/utils/scanSession";
import { cropRectToWhite } from "@/utils/isolateStrip";

export const Route = createFileRoute("/scan-adjust")({
  head: () => ({ meta: [{ title: "כוונון ידני — PoolCheck" }] }),
  component: ScanAdjustScreen,
});

type Rect = { x: number; y: number; w: number; h: number };
type DragMode =
  | { kind: "none" }
  | { kind: "move"; startX: number; startY: number; rect: Rect }
  | {
      kind: "resize";
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      rect: Rect;
    };

function ScanAdjustScreen() {
  const navigate = useNavigate();
  const [raw, setRaw] = useState<string | undefined>();
  const [rect, setRect] = useState<Rect>({ x: 0.35, y: 0.15, w: 0.3, h: 0.7 });
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragMode>({ kind: "none" });

  useEffect(() => {
    const sess = scanSession.get();
    if (!sess.rawImageDataUrl) {
      navigate({ to: "/scan" });
      return;
    }
    setRaw(sess.rawImageDataUrl);
  }, [navigate]);

  function clamp(v: number, min = 0, max = 1) {
    return Math.max(min, Math.min(max, v));
  }

  function pointerToNorm(e: React.PointerEvent) {
    const el = containerRef.current!;
    const r = el.getBoundingClientRect();
    return {
      nx: clamp((e.clientX - r.left) / r.width),
      ny: clamp((e.clientY - r.top) / r.height),
    };
  }

  function startMove(e: React.PointerEvent) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const { nx, ny } = pointerToNorm(e);
    dragRef.current = { kind: "move", startX: nx, startY: ny, rect: { ...rect } };
  }

  function startResize(handle: "nw" | "ne" | "sw" | "se") {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      const { nx, ny } = pointerToNorm(e);
      dragRef.current = { kind: "resize", handle, startX: nx, startY: ny, rect: { ...rect } };
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = dragRef.current;
    if (d.kind === "none") return;
    const { nx, ny } = pointerToNorm(e);
    const dx = nx - d.startX;
    const dy = ny - d.startY;
    if (d.kind === "move") {
      const x = clamp(d.rect.x + dx, 0, 1 - d.rect.w);
      const y = clamp(d.rect.y + dy, 0, 1 - d.rect.h);
      setRect({ ...d.rect, x, y });
    } else {
      let { x, y, w, h } = d.rect;
      const minSize = 0.05;
      if (d.handle === "nw") {
        const nx2 = clamp(x + dx, 0, x + w - minSize);
        const ny2 = clamp(y + dy, 0, y + h - minSize);
        w = w + (x - nx2);
        h = h + (y - ny2);
        x = nx2;
        y = ny2;
      } else if (d.handle === "ne") {
        const ny2 = clamp(y + dy, 0, y + h - minSize);
        h = h + (y - ny2);
        y = ny2;
        w = clamp(w + dx, minSize, 1 - x);
      } else if (d.handle === "sw") {
        const nx2 = clamp(x + dx, 0, x + w - minSize);
        w = w + (x - nx2);
        x = nx2;
        h = clamp(h + dy, minSize, 1 - y);
      } else if (d.handle === "se") {
        w = clamp(w + dx, minSize, 1 - x);
        h = clamp(h + dy, minSize, 1 - y);
      }
      setRect({ x, y, w, h });
    }
  }

  function onPointerUp() {
    dragRef.current = { kind: "none" };
  }

  async function handleApply() {
    if (!raw) return;
    setBusy(true);
    try {
      const cropped = await cropRectToWhite(raw, rect);
      scanSession.set({ pendingImageDataUrl: cropped });
      navigate({ to: "/scan-confirm" });
    } catch (e) {
      console.error(e);
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        <Link
          to="/scan-confirm"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 transition hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Move className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">
              סמן את הסטיק ידנית
            </h1>
            <p className="text-sm text-muted-foreground">
              גרור את המסגרת והפינות כך שתעטוף רק את הריבועים הצבעוניים
            </p>
          </div>
        </div>

        <div
          ref={containerRef}
          className="relative mt-6 overflow-hidden rounded-3xl border border-border/60 bg-black/80 select-none touch-none"
          style={{ aspectRatio: "3 / 4" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {raw ? (
            <img
              src={raw}
              alt="תמונה גולמית"
              className="absolute inset-0 h-full w-full object-contain pointer-events-none"
              draggable={false}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* dim overlay outside rect */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `
                linear-gradient(to right, rgba(0,0,0,0.55) ${rect.x * 100}%, transparent ${rect.x * 100}%, transparent ${(rect.x + rect.w) * 100}%, rgba(0,0,0,0.55) ${(rect.x + rect.w) * 100}%),
                linear-gradient(to bottom, rgba(0,0,0,0.55) ${rect.y * 100}%, transparent ${rect.y * 100}%, transparent ${(rect.y + rect.h) * 100}%, rgba(0,0,0,0.55) ${(rect.y + rect.h) * 100}%)
              `,
            }}
          />

          {/* draggable rect */}
          <div
            onPointerDown={startMove}
            className="absolute border-2 border-primary cursor-move"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.0)",
            }}
          >
            {(["nw", "ne", "sw", "se"] as const).map((h) => (
              <div
                key={h}
                onPointerDown={startResize(h)}
                className="absolute h-7 w-7 rounded-full bg-primary border-2 border-white shadow-lg"
                style={{
                  left: h.includes("w") ? -14 : "auto",
                  right: h.includes("e") ? -14 : "auto",
                  top: h.includes("n") ? -14 : "auto",
                  bottom: h.includes("s") ? -14 : "auto",
                  touchAction: "none",
                }}
              />
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-muted-foreground text-center">
          טיפ: עטוף רק את הריבועים הצבעוניים. אל תכלול אצבעות או רצפה.
        </p>

        <div className="mt-6 space-y-3">
          <button
            onClick={handleApply}
            disabled={busy || !raw}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-6 w-6 animate-spin" /> : <Check className="h-6 w-6" />}
            {busy ? "מחיל..." : "השתמש בחיתוך הזה"}
          </button>
        </div>
      </div>
    </div>
  );
}
