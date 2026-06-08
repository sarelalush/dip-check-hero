import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, CreditCard, LogOut, Shield, Bell, HelpCircle, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { BottomTabBar } from "@/components/BottomTabBar";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "הגדרות — AquaSense" },
      { name: "description", content: "ניהול חשבון, מנוי והעדפות באפליקציה" },
    ],
  }),
  component: SettingsScreen,
});

function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();

  const name = (user?.user_metadata?.display_name as string) || user?.email || "אורח";
  const initial = String(name).trim().charAt(0).toUpperCase() || "?";

  async function handleSignOut() {
    await signOut();
    navigate({ to: "/welcome" });
  }

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#E6F6FB] via-background to-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#BEE6F1]/60 to-transparent" />

      <div className="relative mx-auto max-w-md px-5 pt-6">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-foreground shadow-sm backdrop-blur">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-black text-foreground">הגדרות</h1>
          <div className="w-10" />
        </div>

        {/* Account card */}
        <div className="mt-5 rounded-[28px] bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-black text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
              {initial}
            </div>
            <div className="flex-1 text-right">
              <div className="text-base font-black text-foreground">{name}</div>
              <div className="text-xs font-semibold text-muted-foreground">{user?.email ?? "לא מחובר"}</div>
            </div>
          </div>
        </div>

        {/* Settings groups */}
        <Section title="חשבון ומנוי">
          <Row icon={<CreditCard className="h-5 w-5" />} label="המנוי שלי" to="/pricing" />
          {isAdmin && <Row icon={<Shield className="h-5 w-5" />} label="פאנל מנהל" to="/admin" />}
        </Section>

        <Section title="העדפות">
          <Row icon={<Bell className="h-5 w-5" />} label="התראות" hint="בקרוב" disabled />
        </Section>

        <Section title="עזרה">
          <Row icon={<HelpCircle className="h-5 w-5" />} label="שאלות נפוצות" hint="בקרוב" disabled />
          <Row icon={<Mail className="h-5 w-5" />} label="צור קשר" hint="בקרוב" disabled />
        </Section>

        {user && (
          <button
            onClick={handleSignOut}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-card px-6 py-4 text-base font-black text-rose-600 shadow-[var(--shadow-card)] active:scale-[0.98]"
          >
            <LogOut className="h-5 w-5" />
            יציאה מהחשבון
          </button>
        )}

        <p className="mt-4 text-center text-[11px] font-bold text-muted-foreground">AquaSense · v1.0</p>
      </div>

      <BottomTabBar />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 px-2 text-right text-xs font-black uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="overflow-hidden rounded-[22px] bg-card shadow-[var(--shadow-card)]">{children}</div>
    </div>
  );
}

function Row({
  icon, label, to, hint, disabled,
}: { icon: React.ReactNode; label: string; to?: string; hint?: string; disabled?: boolean }) {
  const content = (
    <div className={`flex items-center justify-between gap-3 px-4 py-3.5 border-b border-border/40 last:border-b-0 ${disabled ? "opacity-60" : "active:bg-muted/40"}`}>
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
      <div className="flex flex-1 items-center justify-end gap-3">
        {hint && <span className="text-[11px] font-bold text-muted-foreground">{hint}</span>}
        <span className="text-sm font-bold text-foreground">{label}</span>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</span>
      </div>
    </div>
  );
  if (disabled || !to) return content;
  return <Link to={to}>{content}</Link>;
}
