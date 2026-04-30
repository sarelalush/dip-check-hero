import type { DosageRecommendation } from "@/utils/calculateDosage";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";

export function ResultCard({ rec }: { rec: DosageRecommendation }) {
  const statusMap = {
    ok: { label: "תקין", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
    low: { label: "נמוך", icon: AlertCircle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
    high: { label: "גבוה", icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  } as const;
  const s = statusMap[rec.status];
  const Icon = s.icon;

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-5 shadow-[var(--shadow-card)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`h-5 w-5 ${s.color}`} />
          <h3 className="text-lg font-bold text-foreground">{rec.labelHe}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.color} ${s.bg} border ${s.border}`}>
          {s.label}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-card/60 p-3">
          <div className="text-muted-foreground text-xs">נמדד</div>
          <div className="font-bold text-foreground">{rec.measured} {rec.unit}</div>
        </div>
        <div className="rounded-xl bg-card/60 p-3">
          <div className="text-muted-foreground text-xs">יעד</div>
          <div className="font-bold text-foreground">{rec.target} {rec.unit}</div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-card p-3">
        <div className="text-xs text-muted-foreground mb-1">המלצה</div>
        <div className="font-semibold text-foreground">{rec.actionHe}</div>
      </div>
    </div>
  );
}
