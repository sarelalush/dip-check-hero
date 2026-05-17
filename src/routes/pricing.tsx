import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles, Plus, Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useState } from "react";

export const Route = createFileRoute("/pricing")({
  head: () => ({ meta: [{ title: "מחירון — PoolCheck" }] }),
  component: PricingScreen,
});

function PricingScreen() {
  const { user, isAuthenticated } = useAuth();
  const { hasBasePlan, extraPools, allowedPools, freeScansRemaining, refetch } =
    useSubscription();
  const { openCheckout, loading } = usePaddleCheckout();
  const navigate = useNavigate();
  const [extraQty, setExtraQty] = useState(1);

  async function buyBase() {
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    await openCheckout({
      priceId: "pool_base_monthly",
      quantity: 1,
      customerEmail: user?.email || undefined,
      userId: user?.id,
      successUrl: `${window.location.origin}/?checkout=success`,
    });
    setTimeout(refetch, 3000);
  }

  async function buyExtra() {
    if (!isAuthenticated) {
      navigate({ to: "/login" });
      return;
    }
    await openCheckout({
      priceId: "pool_extra_monthly",
      quantity: extraQty,
      customerEmail: user?.email || undefined,
      userId: user?.id,
      successUrl: `${window.location.origin}/?checkout=success`,
    });
    setTimeout(refetch, 3000);
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-5 pt-6 pb-12">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4">
          <ArrowRight className="h-4 w-4" /> חזרה
        </Link>

        <div className="text-center mt-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold tracking-[0.18em] text-primary">
            <Sparkles className="h-3 w-3" /> מחירון
          </div>
          <h1 className="mt-3 text-3xl font-extrabold text-foreground">
            תוכניות PoolCheck
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            התחל עם 3 סריקות חינם. שדרג לסריקות ללא הגבלה ושמירת בריכות.
          </p>
        </div>

        {isAuthenticated && (
          <div className="mt-6 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] text-right">
            <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">
              הסטטוס שלך
            </div>
            <div className="mt-1 text-sm font-bold text-foreground">
              {hasBasePlan
                ? `מנוי פעיל · ${allowedPools} ${allowedPools === 1 ? "בריכה" : "בריכות"} שמורות`
                : `${freeScansRemaining} סריקות חינם נותרו`}
            </div>
          </div>
        )}

        {/* Free plan */}
        <div className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">חינם</div>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-foreground">₪0</span>
            <span className="text-sm text-muted-foreground">להתחלה</span>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            <Feat>3 סריקות סטיק חינם</Feat>
            <Feat>ניתוח AI מלא של הצבעים</Feat>
            <Feat>המלצות מדויקות לחומרים</Feat>
            <Feat muted>לא ניתן לשמור בריכות</Feat>
          </ul>
        </div>

        {/* Base plan */}
        <div
          className="mt-4 rounded-3xl p-6 text-primary-foreground shadow-[var(--shadow-soft)] relative overflow-hidden"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="absolute -top-6 -left-6 h-24 w-24 rounded-full bg-white/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold tracking-[0.16em]">
                הכי פופולרי
              </span>
              <span className="text-xs font-semibold tracking-[0.18em] text-white/80">מנוי בסיס</span>
            </div>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-4xl font-extrabold">₪30</span>
              <span className="text-sm text-white/80">/ חודש</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm">
              <Feat light>סריקות ללא הגבלה</Feat>
              <Feat light>שמירה של בריכה אחת</Feat>
              <Feat light>היסטוריית בדיקות מלאה</Feat>
              <Feat light>סנכרון בכל המכשירים</Feat>
            </ul>
            <button
              onClick={buyBase}
              disabled={loading || hasBasePlan}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3.5 text-base font-bold text-primary transition active:scale-[0.98] disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : hasBasePlan ? (
                "פעיל ✓"
              ) : isAuthenticated ? (
                "התחל מנוי"
              ) : (
                <>
                  <LogIn className="h-4 w-4" /> התחבר וקנה
                </>
              )}
            </button>
          </div>
        </div>

        {/* Extra pool addon */}
        <div className="mt-4 rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] text-secondary-foreground">
              תוסף
            </span>
            <span className="text-xs font-semibold tracking-[0.18em] text-muted-foreground">בריכה נוספת</span>
          </div>
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-foreground">₪10</span>
            <span className="text-sm text-muted-foreground">/ חודש לכל בריכה</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            דורש מנוי בסיס פעיל. {hasBasePlan && `יש לך כרגע ${extraPools} בריכות נוספות.`}
          </p>

          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => setExtraQty(Math.max(1, extraQty - 1))}
              className="h-9 w-9 rounded-full bg-muted text-foreground font-bold"
            >
              −
            </button>
            <span className="min-w-[3rem] text-center text-lg font-bold text-foreground">
              {extraQty}
            </span>
            <button
              onClick={() => setExtraQty(Math.min(20, extraQty + 1))}
              className="h-9 w-9 rounded-full bg-muted text-foreground font-bold"
            >
              +
            </button>
            <span className="text-sm text-muted-foreground">
              = ₪{extraQty * 10}/חודש
            </span>
          </div>

          <button
            onClick={buyExtra}
            disabled={loading || !hasBasePlan}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-bold text-secondary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {!hasBasePlan
              ? "דורש מנוי בסיס"
              : loading
              ? "טוען..."
              : `הוסף ${extraQty} ${extraQty === 1 ? "בריכה" : "בריכות"}`}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground leading-relaxed">
          תוכל לבטל בכל עת מתוך{" "}
          <a
            href="https://paddle.net"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            paddle.net
          </a>
          . התשלום מאובטח ע״י Paddle.
        </p>
      </div>
    </div>
  );
}

function Feat({ children, light, muted }: { children: React.ReactNode; light?: boolean; muted?: boolean }) {
  return (
    <li className="flex items-center gap-2 text-right">
      <Check className={`h-4 w-4 flex-shrink-0 ${light ? "text-white" : muted ? "text-muted-foreground/50" : "text-primary"}`} />
      <span className={muted ? "text-muted-foreground/70 line-through" : ""}>{children}</span>
    </li>
  );
}
