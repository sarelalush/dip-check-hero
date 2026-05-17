import { Link } from "@tanstack/react-router";
import { Lock, Sparkles, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Reason = "guest" | "free-exhausted" | "pool-limit";

interface PaywallProps {
  reason: Reason;
  freeScansRemaining?: number;
  allowedPools?: number;
}

export function PaywallCard({ reason, freeScansRemaining, allowedPools }: PaywallProps) {
  const { isAuthenticated } = useAuth();

  const content = {
    guest: {
      title: "התחבר כדי לסרוק",
      body: "אורחים יכולים לצפות באפליקציה — כדי לסרוק סטיק יש להתחבר. כל משתמש חדש מקבל 3 סריקות חינם.",
      cta: "התחבר / הירשם",
      to: "/login" as const,
    },
    "free-exhausted": {
      title: "ניצלת את 3 הסריקות החינם",
      body: "כדי להמשיך לסרוק ללא הגבלה ולשמור את הבריכה שלך — שדרג למנוי של ₪30/חודש.",
      cta: "צפה בתוכניות",
      to: "/pricing" as const,
    },
    "pool-limit": {
      title: `הגעת למגבלת ${allowedPools ?? 1} ${(allowedPools ?? 1) === 1 ? "בריכה" : "בריכות"}`,
      body: "הוסף בריכה נוספת למנוי שלך תמורת ₪10/חודש בלבד.",
      cta: "הוסף בריכה למנוי",
      to: "/pricing" as const,
    },
  }[reason];

  return (
    <div
      dir="rtl"
      className="relative overflow-hidden rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-soft)]"
      style={{ background: "var(--gradient-hero)" }}
    >
      <div className="absolute -top-8 -left-8 h-32 w-32 rounded-full bg-white/15 blur-3xl" />
      <div className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-white/20 backdrop-blur-sm">
          <Lock className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-xl font-extrabold leading-tight">{content.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/90">{content.body}</p>

        {reason === "free-exhausted" && typeof freeScansRemaining === "number" && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold">
            <Sparkles className="h-3 w-3" /> 0 / 3 סריקות חינם נותרו
          </div>
        )}

        <Link
          to={content.to}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-base font-bold text-primary transition active:scale-[0.98]"
        >
          {reason === "guest" && <LogIn className="h-4 w-4" />}
          {content.cta}
        </Link>

        {reason !== "guest" && !isAuthenticated && (
          <p className="mt-3 text-center text-xs text-white/80">
            יש לך כבר חשבון?{" "}
            <Link to="/login" className="underline font-semibold">
              התחבר
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
