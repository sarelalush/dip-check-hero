import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Shield,
  Users,
  FlaskConical,
  Loader2,
  ChevronDown,
  ChevronUp,
  Crown,
  CreditCard,
  Plus,
  Minus,
  Waves,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { TestItem, type TestRow, type PoolRow } from "@/components/ScanHistory";
import { getPaddleEnvironment } from "@/lib/paddle";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "לוח ניהול — PoolCheck" }] }),
  component: AdminScreen,
});

interface ProfileRow {
  user_id: string;
  display_name: string | null;
  email: string | null;
  created_at: string;
  free_scans_used: number;
}

interface RoleRow {
  user_id: string;
  role: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  product_id: string;
  price_id: string;
  status: string;
  environment: string;
  quantity: number;
  current_period_end: string | null;
  paddle_subscription_id: string;
  paddle_customer_id: string;
}

const FAR_FUTURE = "2099-12-31T00:00:00.000Z";

function isSubActive(s: SubscriptionRow): boolean {
  if (!["active", "trialing"].includes(s.status)) {
    if (s.status === "canceled" && s.current_period_end && new Date(s.current_period_end) > new Date()) return true;
    return false;
  }
  if (!s.current_period_end) return true;
  return new Date(s.current_period_end) > new Date();
}

function AdminScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [pools, setPools] = useState<PoolRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const env = getPaddleEnvironment();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) navigate({ to: "/login" });
  }, [authLoading, isAuthenticated, navigate]);

  const refresh = useCallback(async () => {
    const [p, t, pl, r, s] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("tests").select("*").order("tested_at", { ascending: false }),
      supabase.from("pools").select("id, user_id, name"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("subscriptions").select("*").eq("environment", env),
    ]);
    setProfiles((p.data ?? []) as ProfileRow[]);
    setTests((t.data ?? []) as TestRow[]);
    setPools((pl.data ?? []) as PoolRow[]);
    setRoles((r.data ?? []) as RoleRow[]);
    setSubs((s.data ?? []) as SubscriptionRow[]);
    setLoading(false);
  }, [env]);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    refresh();
  }, [adminLoading, isAdmin, refresh]);

  const testsByUser = useMemo(() => {
    const map = new Map<string, TestRow[]>();
    for (const t of tests) {
      const arr = map.get(t.user_id) ?? [];
      arr.push(t);
      map.set(t.user_id, arr);
    }
    return map;
  }, [tests]);

  const poolsByUser = useMemo(() => {
    const map = new Map<string, PoolRow[]>();
    for (const p of pools) {
      const arr = map.get(p.user_id) ?? [];
      arr.push(p);
      map.set(p.user_id, arr);
    }
    return map;
  }, [pools]);

  const poolName = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of pools) map.set(p.id, p.name);
    return map;
  }, [pools]);

  const adminIds = useMemo(() => new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id)), [roles]);

  const subsByUser = useMemo(() => {
    const map = new Map<string, { base?: SubscriptionRow; addon?: SubscriptionRow }>();
    for (const s of subs) {
      const cur = map.get(s.user_id) ?? {};
      if (s.product_id === "pool_base_plan" && isSubActive(s)) cur.base = s;
      if (s.product_id === "pool_extra_addon" && isSubActive(s)) cur.addon = s;
      map.set(s.user_id, cur);
    }
    return map;
  }, [subs]);

  async function toggleAdmin(userId: string, currentlyAdmin: boolean) {
    setBusy(`admin-${userId}`);
    try {
      if (currentlyAdmin) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
        if (error) throw error;
        toast.success("הרשאת מנהל הוסרה");
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
        if (error) throw error;
        toast.success("המשתמש הוגדר כמנהל");
      }
      await refresh();
    } catch (e) {
      toast.error("פעולה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function togglePaidAccess(userId: string, existing: SubscriptionRow | undefined) {
    setBusy(`paid-${userId}`);
    try {
      if (existing) {
        const { error } = await supabase.from("subscriptions").delete().eq("id", existing.id);
        if (error) throw error;
        toast.success("גישת הסריקה הוסרה");
      } else {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: userId,
          environment: env,
          product_id: "pool_base_plan",
          price_id: "admin_grant",
          status: "active",
          quantity: 1,
          current_period_end: FAR_FUTURE,
          paddle_subscription_id: `admin_${userId}_base_${Date.now()}`,
          paddle_customer_id: `admin_${userId}`,
        });
        if (error) throw error;
        toast.success("ניתנה גישת סריקה");
      }
      await refresh();
    } catch (e) {
      toast.error("פעולה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function adjustExtraPools(userId: string, addon: SubscriptionRow | undefined, delta: number) {
    setBusy(`pool-${userId}`);
    try {
      const newQty = (addon?.quantity ?? 0) + delta;
      if (newQty <= 0) {
        if (addon) {
          const { error } = await supabase.from("subscriptions").delete().eq("id", addon.id);
          if (error) throw error;
        }
      } else if (addon) {
        const { error } = await supabase
          .from("subscriptions")
          .update({ quantity: newQty })
          .eq("id", addon.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscriptions").insert({
          user_id: userId,
          environment: env,
          product_id: "pool_extra_addon",
          price_id: "admin_grant",
          status: "active",
          quantity: newQty,
          current_period_end: FAR_FUTURE,
          paddle_subscription_id: `admin_${userId}_addon_${Date.now()}`,
          paddle_customer_id: `admin_${userId}`,
        });
        if (error) throw error;
      }
      toast.success("מכסת הבריכות עודכנה");
      await refresh();
    } catch (e) {
      toast.error("פעולה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  if (authLoading || adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div dir="rtl" className="min-h-screen bg-background">
        <div className="mx-auto max-w-md px-5 pt-10 text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-extrabold text-foreground">אין לך הרשאת גישה</h1>
          <p className="mt-2 text-sm text-muted-foreground">דף זה מיועד למנהלי המערכת בלבד.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-primary">
            <ArrowRight className="h-4 w-4" /> חזרה לעמוד הראשי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-5 pt-6 pb-10">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground">
          <ArrowRight className="h-4 w-4" /> חזרה לעמוד הראשי
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-foreground leading-tight">לוח ניהול</h1>
            <p className="text-sm text-muted-foreground">ניהול משתמשים, הרשאות ותוכניות</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard icon={<Users className="h-5 w-5" />} label="משתמשים רשומים" value={profiles.length} />
          <StatCard icon={<FlaskConical className="h-5 w-5" />} label="סך סריקות" value={tests.length} />
          <StatCard icon={<Crown className="h-5 w-5" />} label="מנהלים" value={adminIds.size} />
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {profiles.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                עדיין אין משתמשים רשומים.
              </div>
            )}
            {profiles.map((p) => {
              const userTests = testsByUser.get(p.user_id) ?? [];
              const userPools = poolsByUser.get(p.user_id) ?? [];
              const expanded = expandedUser === p.user_id;
              const isUserAdmin = adminIds.has(p.user_id);
              const userSubs = subsByUser.get(p.user_id) ?? {};
              const hasPaid = !!userSubs.base;
              const extraPools = userSubs.addon?.quantity ?? 0;
              const allowedPools = (hasPaid || isUserAdmin ? 1 : 0) + extraPools + (isUserAdmin ? 0 : 0);

              return (
                <div key={p.user_id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <button
                    onClick={() => setExpandedUser(expanded ? null : p.user_id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-right transition hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {userTests.length} סריקות
                      </span>
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-bold text-sky-700">
                        {userPools.length} בריכות
                      </span>
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">
                          {p.display_name || p.email || "ללא שם"}
                        </span>
                        {isUserAdmin && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                            <Crown className="h-3 w-3" /> מנהל
                          </span>
                        )}
                        {hasPaid && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            <CreditCard className="h-3 w-3" /> בתשלום
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.email} · נרשם {new Date(p.created_at).toLocaleDateString("he-IL")}
                      </div>
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border bg-muted/30 px-4 py-4 space-y-4">
                      {/* Admin controls */}
                      <div className="rounded-xl border border-border bg-background p-3 space-y-3">
                        <div className="text-xs font-extrabold text-muted-foreground">פעולות ניהול</div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Crown className="h-4 w-4 text-amber-600" />
                            <span className="font-semibold text-foreground">הרשאת מנהל</span>
                            <span className="text-xs text-muted-foreground">{isUserAdmin ? "פעיל" : "לא פעיל"}</span>
                          </div>
                          <button
                            disabled={busy === `admin-${p.user_id}`}
                            onClick={() => toggleAdmin(p.user_id, isUserAdmin)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                              isUserAdmin
                                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                : "bg-amber-500 text-white hover:bg-amber-600"
                            }`}
                          >
                            {busy === `admin-${p.user_id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                            {isUserAdmin ? "הסר הרשאת מנהל" : "הפוך למנהל"}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                          <div className="flex items-center gap-2 text-sm">
                            <CreditCard className="h-4 w-4 text-emerald-600" />
                            <span className="font-semibold text-foreground">גישת סריקה (תשלום)</span>
                            <span className="text-xs text-muted-foreground">{hasPaid ? "פעיל" : "ללא"}</span>
                          </div>
                          <button
                            disabled={busy === `paid-${p.user_id}`}
                            onClick={() => togglePaidAccess(p.user_id, userSubs.base)}
                            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                              hasPaid
                                ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                                : "bg-emerald-500 text-white hover:bg-emerald-600"
                            }`}
                          >
                            {busy === `paid-${p.user_id}` && <Loader2 className="h-3 w-3 animate-spin" />}
                            {hasPaid ? "בטל גישה" : "הענק גישה"}
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                          <div className="flex items-center gap-2 text-sm">
                            <Waves className="h-4 w-4 text-sky-600" />
                            <span className="font-semibold text-foreground">מכסת בריכות</span>
                            <span className="text-xs text-muted-foreground">
                              {allowedPools} מורשות · {extraPools} תוספות
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              disabled={busy === `pool-${p.user_id}` || extraPools <= 0}
                              onClick={() => adjustExtraPools(p.user_id, userSubs.addon, -1)}
                              className="rounded-lg bg-muted px-2 py-1.5 text-foreground hover:bg-muted/80 disabled:opacity-40"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-bold text-foreground">
                              {extraPools}
                            </span>
                            <button
                              disabled={busy === `pool-${p.user_id}`}
                              onClick={() => adjustExtraPools(p.user_id, userSubs.addon, +1)}
                              className="rounded-lg bg-sky-500 px-2 py-1.5 text-white hover:bg-sky-600 disabled:opacity-50"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Scans */}
                      <div>
                        <div className="mb-2 text-xs font-extrabold text-muted-foreground">סריקות</div>
                        {userTests.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-3">אין סריקות למשתמש זה</p>
                        ) : (
                          <div className="space-y-2">
                            {userTests.map((t) => (
                              <TestItem key={t.id} test={t} poolName={poolName.get(t.pool_id) ?? "—"} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <div className="mt-1 text-3xl font-extrabold text-foreground">{value}</div>
    </div>
  );
}
