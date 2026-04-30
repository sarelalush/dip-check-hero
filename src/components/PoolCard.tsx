import { Link } from "@tanstack/react-router";
import type { Pool } from "@/utils/storage";
import { Droplets, Waves } from "lucide-react";

export function PoolCard({
  pool,
  onClick,
  to,
}: {
  pool: Pool;
  onClick?: () => void;
  to?: string;
}) {
  const content = (
    <div className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-soft)] hover:-translate-y-0.5">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--gradient-hero)] text-primary-foreground">
        {pool.type === "salt" ? <Waves className="h-6 w-6" /> : <Droplets className="h-6 w-6" />}
      </div>
      <div className="flex-1 text-right">
        <div className="font-semibold text-foreground">{pool.name}</div>
        <div className="text-sm text-muted-foreground">
          {pool.type === "salt" ? "בריכת מלח" : "כלור רגיל"} · {pool.volumeLiters.toLocaleString("he-IL")} ליטר
        </div>
        {pool.lastTestAt && (
          <div className="text-xs text-muted-foreground mt-0.5">
            בדיקה אחרונה: {new Date(pool.lastTestAt).toLocaleDateString("he-IL")}
          </div>
        )}
      </div>
    </div>
  );

  if (to) return <Link to={to}>{content}</Link>;
  return <button onClick={onClick} className="w-full text-right">{content}</button>;
}
