import { createFileRoute, Link } from "@tanstack/react-router";
import { Camera, Droplets, ListChecks } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "בדיקת מים לבריכה — PoolCheck" },
      { name: "description", content: "צלם סטיק בדיקה וקבל המלצה כמה חומר להוסיף לבריכה" },
    ],
  }),
  component: HomeScreen,
});

function HomeScreen() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-10 pb-8">
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
          תומך ב-AquaChek Pool Test Strips · MVP
        </p>
      </div>
    </div>
  );
}
