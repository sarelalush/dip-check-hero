import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, Droplets, ListChecks, LogOut } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { GuestBanner } from "@/components/GuestBanner";

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
  const { isAuthenticated, isGuest, loading, user, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isAuthenticated && !isGuest) {
      navigate({ to: "/welcome" });
    }
  }, [loading, isAuthenticated, isGuest, navigate]);

  if (loading || (!isAuthenticated && !isGuest)) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={async () => { await signOut(); navigate({ to: "/welcome" }); }}
            className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            {isAuthenticated ? "יציאה" : "צא ממצב אורח"}
          </button>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">שלום</div>
            <div className="text-sm font-bold text-foreground">
              {isAuthenticated ? (user?.user_metadata?.display_name || user?.email) : "אורח"}
            </div>
          </div>
        </div>

        <GuestBanner />

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl p-8 text-primary-foreground shadow-[var(--shadow-soft)]"
             style={{ background: "var(--gradient-hero)" }}>
          <div className="absolute -left-10 -bottom-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/15 blur-xl" />
          <Droplets className="h-10 w-10 mb-3 opacity-90" />
          <h1 className="text-3xl font-extrabold leading-tight">בדיקת מים לבריכה</h1>
          <p className="mt-2 text-primary-foreground/90 text-sm leading-relaxed">
            צלם את סטיק הבדיקה וקבל המלצה מדויקת כמה חומר להוסיף לבריכה שלך.
          </p>
        </div>

        {/* Actions */}
        <div className="mt-8 space-y-3">
          <Link
            to="/scan"
            className="flex items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-5 text-lg font-bold text-primary-foreground shadow-[var(--shadow-soft)] transition active:scale-[0.98]"
          >
            <Camera className="h-6 w-6" />
            סרוק סטיק עכשיו
          </Link>
          <Link
            to="/pools"
            className="flex items-center justify-center gap-3 rounded-2xl border-2 border-primary/20 bg-card px-6 py-4 text-base font-semibold text-foreground transition active:scale-[0.98]"
          >
            <ListChecks className="h-5 w-5 text-primary" />
            הבריכות שלי
          </Link>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground leading-relaxed">
          תומך ב-AquaChek Pool Test Strips
        </p>
      </div>
    </div>
  );
}
