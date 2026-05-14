import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Droplet, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/welcome")({
  head: () => ({ meta: [{ title: "AquaSense — ניהול חכם לבריכה" }] }),
  component: WelcomeScreen,
});

function WelcomeScreen() {
  const { isAuthenticated, isGuest, continueAsGuest, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (isAuthenticated || isGuest)) {
      navigate({ to: "/" });
    }
  }, [loading, isAuthenticated, isGuest, navigate]);

  return (
    <div
      dir="rtl"
      className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden px-6 pb-10 pt-14 text-white"
      style={{
        background:
          "linear-gradient(160deg, oklch(0.42 0.12 240) 0%, oklch(0.55 0.14 220) 50%, oklch(0.72 0.14 195) 100%)",
      }}
    >
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-cyan-300/20 blur-3xl" />

      {/* Header / brand */}
      <div className="z-10 flex w-full items-center justify-end gap-3 pt-2">
        <div className="text-right">
          <div className="text-xs font-semibold tracking-[0.25em] text-white/70">AQUASENSE</div>
          <div className="text-base font-bold text-white">ניהול חכם לבריכה</div>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm">
          <Droplet className="h-6 w-6 text-white" fill="white" />
        </div>
      </div>

      {/* Hero */}
      <div className="z-10 mt-10 flex max-w-md flex-col items-end text-right">
        <Sparkles className="mb-4 h-7 w-7 text-cyan-200" />
        <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
          מים מאוזנים.
          <br />
          בלי לנחש.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/80">
          סורקים סרט בדיקה, מקבלים תוצאות מיידיות והנחיות מינון מדויקות לבריכה שלכם.
        </p>
      </div>

      {/* Actions */}
      <div className="z-10 w-full max-w-md space-y-3">
        <Link
          to="/signup"
          className="block w-full rounded-full bg-white py-4 text-center text-base font-bold text-cyan-700 shadow-xl transition active:scale-[0.98]"
        >
          יצירת חשבון חדש
        </Link>
        <Link
          to="/login"
          className="block w-full rounded-full border border-white/40 bg-white/10 py-4 text-center text-base font-bold text-white backdrop-blur-sm transition active:scale-[0.98]"
        >
          התחברות
        </Link>
        <button
          onClick={() => {
            continueAsGuest();
            navigate({ to: "/" });
          }}
          className="block w-full pt-2 text-center text-sm font-medium text-white/80 underline-offset-4 hover:underline"
        >
          המשך כאורח
        </button>
      </div>
    </div>
  );
}
