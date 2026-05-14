import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function GuestBanner() {
  const { isGuest, guestExpiresAt } = useAuth();
  if (!isGuest) return null;
  const hoursLeft = guestExpiresAt
    ? Math.max(0, Math.round((guestExpiresAt - Date.now()) / (60 * 60 * 1000)))
    : 24;
  return (
    <div className="mx-auto mb-4 max-w-md rounded-2xl border border-warning/40 bg-warning/10 p-3 text-right text-xs text-warning-foreground/90">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <div className="flex-1">
          <div className="font-semibold text-foreground">אתם משתמשים כאורחים</div>
          <p className="mt-0.5 text-muted-foreground">
            הנתונים שלכם נשמרים זמנית למכשיר זה בלבד ויימחקו בעוד כ-{hoursLeft} שעות.{" "}
            <Link to="/signup" className="font-bold text-primary underline-offset-2 hover:underline">
              הירשמו לשמירה קבועה
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
