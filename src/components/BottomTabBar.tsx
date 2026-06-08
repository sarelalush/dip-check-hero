import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Droplets, History, Settings, ScanLine } from "lucide-react";

/**
 * Mobile-style bottom tab bar. Renders fixed at the bottom of the viewport
 * on inner app screens (home, pools, history, scan). The middle scan button
 * is enlarged and elevated like the reference design.
 */
export function BottomTabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (...paths: string[]) =>
    paths.some((p) => pathname === p || pathname.startsWith(p + "/"));

  return (
    <>
      {/* spacer so content doesn't sit under the bar */}
      <div className="h-24" aria-hidden />
      <nav
        dir="rtl"
        className="fixed inset-x-0 bottom-0 z-40 pointer-events-none"
      >
        <div className="mx-auto max-w-md px-4 pb-4 pointer-events-auto">
          <div className="relative flex items-end justify-between rounded-[28px] bg-card/95 px-3 pt-3 pb-2 shadow-[0_-4px_24px_-8px_rgba(8,145,178,0.25)] backdrop-blur-md border border-border/60">
            <TabItem
              to="/"
              label="בית"
              icon={<Home className="h-5 w-5" />}
              active={isActive("/")}
            />
            <TabItem
              to="/pools"
              label="בריכות"
              icon={<Droplets className="h-5 w-5" />}
              active={isActive("/pools", "/pool")}
            />
            <ScanTab active={isActive("/scan", "/select-strip", "/scan-live", "/scan-confirm")} />
            <TabItem
              to="/history"
              label="היסטוריה"
              icon={<History className="h-5 w-5" />}
              active={isActive("/history", "/results")}
            />
            <TabItem
              to="/pricing"
              label="הגדרות"
              icon={<Settings className="h-5 w-5" />}
              active={isActive("/pricing", "/admin")}
            />
          </div>
        </div>
      </nav>
    </>
  );
}

function TabItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex w-14 flex-col items-center gap-0.5 py-1 transition ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl transition ${
          active ? "bg-primary/10" : "bg-transparent"
        }`}
      >
        {icon}
      </span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );
}

function ScanTab({ active }: { active: boolean }) {
  return (
    <Link
      to="/select-strip"
      className="-mt-7 flex w-16 flex-col items-center gap-1"
    >
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full text-primary-foreground shadow-[0_10px_24px_-6px_rgba(8,145,178,0.55)] transition active:scale-95 ${
          active ? "ring-4 ring-primary/20" : ""
        }`}
        style={{ background: "var(--gradient-hero)" }}
      >
        <ScanLine className="h-7 w-7" />
      </span>
      <span className="text-[10px] font-bold text-primary">סריקה</span>
    </Link>
  );
}
