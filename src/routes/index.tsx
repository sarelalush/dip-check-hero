import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, Droplets, ListChecks, LogOut, Sparkles, Shield, Crown, Gift } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useSubscription } from "@/hooks/useSubscription";
import { WaterWaves } from "@/components/WaterWaves";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AquaSense — בדיקת מים לבריכה" },
      { name: "description", content: "צלם סטיק בדיקה וקבל המלצה כמה חומר להוסיף לבריכה" },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  const { isAuthenticated, loading, user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { isEarlyBird, isPaying } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate({ to: "/welcome" });
    }
  }, [loading, isAuthenticated, navigate]);

  if (loading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const badge = isAdmin
    ? { icon: Shield, label: "מנהל", className: "bg-amber-100 text-amber-900 border-amber-300" }
    : isPaying
      ? { icon: Crown, label: "פרימיום", className: "bg-primary/10 text-primary border-primary/30" }
      : isEarlyBird
        ? { icon: Gift, label: "חודש חינם", className: "bg-emerald-100 text-emerald-900 border-emerald-300" }
        : null;

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-10">
        {/* Top bar */}
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={async () => { await signOut(); navigate({ to: "/welcome" }); }}
            className="flex items-center gap-1.5 rounded-full bg-muted/70 px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-muted"
          >
            <LogOut className="h-3.5 w-3.5" />
            יציאה
          </button>
          <div className="flex items-center gap-2.5">
            <div className="text-right">
              <div className="text-[11px] font-semibold tracking-[0.18em] text-muted-foreground">שלום</div>
              <div className="text-sm font-bold text-foreground">
                {user?.user_metadata?.display_name || user?.email}
              </div>
              {badge && (
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                  <badge.icon className="h-3 w-3" />
                  {badge.label}
                </div>
              )}
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Droplets className="h-5 w-5" fill="currentColor" />
            </div>
          </div>
        </div>

        {/* Hero with animated waves */}
        <div
          className="relative overflow-hidden rounded-[28px] p-7 pb-24 text-primary-foreground shadow-[var(--shadow-soft)]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -right-8 -top-10 h-36 w-36 rounded-full bg-white/20 blur-2xl" />

          <div className="relative z-10 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-100" />
            <span className="text-[11px] font-semibold tracking-[0.22em] text-white/80">AQUASENSE</span>
          </div>
          <h1 className="relative z-10 mt-3 text-3xl font-extrabold leading-tight">
            בדיקת מים
            <br />
            לבריכה שלך
          </h1>
          <p className="relative z-10 mt-2 max-w-[18rem] text-sm leading-relaxed text-white/85">
            צלם את סטיק הבדיקה וקבל המלצה מדויקת כמה חומר להוסיף.
          </p>

          <WaterWaves tone="light" height="h-24" />
        </div>

        {/* Actions */}
        <div className="mt-6 space-y-3">
          <Link
            to="/select-strip"
            className="group relative flex items-center justify-center gap-3 overflow-hidden rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
          >
            <span
              className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100"
              style={{ background: "var(--gradient-hero)" }}
            />
            <Camera className="relative h-6 w-6" />
            <span className="relative">סרוק סטיק עכשיו</span>
          </Link>
          <Link
            to="/pools"
            className="flex items-center justify-center gap-3 rounded-2xl border border-primary/15 bg-card px-6 py-4 text-base font-semibold text-foreground shadow-sm transition hover:border-primary/30 active:scale-[0.98]"
          >
            <ListChecks className="h-5 w-5 text-primary" />
            הבריכות שלי
          </Link>

          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center justify-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-50 px-6 py-4 text-base font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 active:scale-[0.98]"
            >
              <Shield className="h-5 w-5" />
              לוח ניהול
            </Link>
          )}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground leading-relaxed">
          תומך ב-AquaChek Pool Test Strips
        </p>
      </div>
    </div>
  );
}
