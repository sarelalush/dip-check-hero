import type { DosageRecommendation } from "@/utils/calculateDosage";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";

// Display range per parameter — wider than the "ok" target band so the
// fill animates meaningfully even when values are extreme.
const DISPLAY_RANGE: Record<string, { min: number; max: number }> = {
  freeChlorine: { min: 0, max: 6 },
  ph: { min: 6.2, max: 8.4 },
  alkalinity: { min: 0, max: 240 },
  cyanuricAcid: { min: 0, max: 150 },
  salt: { min: 0, max: 6000 },
  totalChlorine: { min: 0, max: 10 },
  bromine: { min: 0, max: 20 },
  hardness: { min: 0, max: 1000 },
};

const STATUS_COLOR: Record<DosageRecommendation["status"], string> = {
  ok: "var(--success)",
  low: "var(--warning)",
  high: "var(--destructive)",
};

const STATUS_LABEL: Record<DosageRecommendation["status"], string> = {
  ok: "תקין",
  low: "נמוך",
  high: "גבוה",
};

const STATUS_ICON = {
  ok: CheckCircle2,
  low: AlertCircle,
  high: AlertTriangle,
} as const;

// Geometry — half-donut from 180° (right edge in RTL = left of viewBox) to 360°.
const SIZE = 320;
const CX = SIZE / 2;
const CY = SIZE * 0.78; // arcs sit in the bottom-anchored half-circle
const RING_GAP = 22;
const RING_THICK = 14;
const BASE_RADIUS = 50;

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** Build SVG arc path for the upper half (angles 180° → 360°). */
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  // sweep=1 so it draws clockwise across the top
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

interface RowProps {
  rec: DosageRecommendation;
  ringIndex: number;
  totalRings: number;
}

function legendRow({ rec, ringIndex, totalRings }: RowProps) {
  const range = DISPLAY_RANGE[rec.paramKey] ?? { min: 0, max: rec.target * 2 };
  const pct = clamp01((rec.measured - range.min) / (range.max - range.min));
  const color = STATUS_COLOR[rec.status];
  return (
    <div key={rec.paramKey} className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-bold tabular-nums text-white"
          style={{ backgroundColor: color }}
        >
          {rec.unit === "" ? rec.measured : `${rec.measured}${rec.unit ? " " + rec.unit : ""}`}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-foreground leading-tight">
          {rec.labelHe}
        </div>
        <div className="text-[11px] text-muted-foreground">
          יעד {rec.target}{rec.unit ? " " + rec.unit : ""}
        </div>
      </div>
    </div>
  );
}

export function ParameterArcs({ recs }: { recs: DosageRecommendation[] }) {
  // Outer ring = first parameter (most prominent). Reverse so first item
  // gets the largest radius (matches the inspiration screenshot).
  const ordered = [...recs];

  return (
    <div className="rounded-3xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
        {/* Right column: status badges + labels (RTL) */}
        <div className="space-y-4 pt-2 min-w-0">
          {ordered.map((rec) => {
            const Icon = STATUS_ICON[rec.status];
            const color = STATUS_COLOR[rec.status];
            return (
              <div key={`label-${rec.paramKey}`} className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color }} />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground leading-tight">
                    {STATUS_LABEL[rec.status]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {rec.labelHe}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Left column: concentric arcs */}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE * 0.85}`}
          width="220"
          height="190"
          className="shrink-0"
          aria-hidden
        >
          <defs>
            {ordered.map((rec, i) => (
              <linearGradient
                key={`g-${rec.paramKey}`}
                id={`grad-${rec.paramKey}`}
                x1="0"
                y1="0"
                x2="1"
                y2="0"
              >
                <stop offset="0%" stopColor={STATUS_COLOR[rec.status]} stopOpacity="0.4" />
                <stop offset="100%" stopColor={STATUS_COLOR[rec.status]} />
              </linearGradient>
            ))}
          </defs>

          {ordered.map((rec, i) => {
            const r = BASE_RADIUS + (ordered.length - 1 - i) * RING_GAP;
            const range = DISPLAY_RANGE[rec.paramKey] ?? { min: 0, max: rec.target * 2 };
            const valuePct = clamp01((rec.measured - range.min) / (range.max - range.min));
            const targetPct = clamp01((rec.target - range.min) / (range.max - range.min));
            const startAngle = 180;
            const endAngle = 360;
            const sweep = endAngle - startAngle;
            const valueAngle = startAngle + sweep * valuePct;
            const targetAngle = startAngle + sweep * targetPct;
            const targetMark = polar(CX, CY, r, targetAngle);

            return (
              <g key={`ring-${rec.paramKey}`}>
                {/* track */}
                <path
                  d={arcPath(CX, CY, r, startAngle, endAngle)}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth={RING_THICK}
                  strokeLinecap="round"
                />
                {/* value fill */}
                {valuePct > 0.01 && (
                  <path
                    d={arcPath(CX, CY, r, startAngle, Math.max(startAngle + 1, valueAngle))}
                    fill="none"
                    stroke={`url(#grad-${rec.paramKey})`}
                    strokeWidth={RING_THICK}
                    strokeLinecap="round"
                  />
                )}
                {/* target tick */}
                <line
                  x1={targetMark.x}
                  y1={targetMark.y - RING_THICK / 2 - 2}
                  x2={targetMark.x}
                  y2={targetMark.y + RING_THICK / 2 + 2}
                  stroke="var(--foreground)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  opacity={0.6}
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend rows under the arcs */}
      <div className="mt-5 space-y-2.5 border-t border-border pt-4">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>ערך נוכחי</span>
          <span>נקודת יעד ↓</span>
        </div>
        {ordered.map((rec) =>
          legendRow({ rec, ringIndex: 0, totalRings: ordered.length }),
        )}
      </div>
    </div>
  );
}
