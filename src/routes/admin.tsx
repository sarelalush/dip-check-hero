import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  Loader2,
  RefreshCcw,
  ScanLine,
  Search,
  Shield,
  Users,
  Waves,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "לוח ניהול - AquaSense" }] }),
  component: AdminScreen,
});

type RpcError = { message: string };

type RpcClient = {
  rpc: (
    functionName: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: RpcError | null }>;
};

type AdminUserRow = {
  account_id: string;
  user_id: string | null;
  email: string | null;
  full_name: string | null;
  account_name: string | null;
  account_status: string | null;
  member_role: string | null;
  joined_at: string | null;
  subscription_id: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  subscription_provider: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  included_pools: number;
  extra_pools: number;
  total_pool_limit: number;
  pools_active_count: number;
  included_scans: number;
  extra_scan_packs: number;
  total_scan_limit: number;
  scans_used: number;
  scans_billable: number;
  scans_remaining: number;
  tests_count: number;
  last_scan_at: string | null;
};

type GrantForm = {
  start: string;
  end: string;
  poolLimit: string;
  scanLimit: string;
};

const rpcClient = supabase as unknown as RpcClient;

function AdminScreen() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [granting, setGranting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);
  const [grantForm, setGrantForm] = useState<GrantForm>(() => createDefaultGrantForm());

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate({ to: "/login" });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const loadDashboard = useCallback(async ({ quiet = false }: { quiet?: boolean } = {}) => {
    if (!quiet) setLoading(true);
    setRefreshing(true);

    const { data, error } = await rpcClient.rpc("admin_dashboard_users");

    if (error) {
      toast.error(`טעינת הדשבורד נכשלה: ${error.message}`);
      setRows([]);
    } else {
      setRows((data ?? []) as AdminUserRow[]);
    }

    setRefreshing(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (adminLoading || !isAdmin) return;
    void loadDashboard();
  }, [adminLoading, isAdmin, loadDashboard]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.email,
        row.full_name,
        row.account_name,
        row.subscription_status,
        row.subscription_provider,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, rows]);

  const stats = useMemo(() => {
    const activeSubscriptions = rows.filter((row) => isSubscriptionActive(row)).length;
    const totalScans = rows.reduce((sum, row) => sum + (row.scans_billable || 0), 0);
    const totalRemaining = rows.reduce((sum, row) => sum + (row.scans_remaining || 0), 0);
    const activePools = rows.reduce((sum, row) => sum + (row.pools_active_count || 0), 0);

    return { activeSubscriptions, totalScans, totalRemaining, activePools };
  }, [rows]);

  function openGrantDialog(row: AdminUserRow) {
    setSelectedUser(row);
    setGrantForm({
      start: toDateTimeInput(row.current_period_start) || toDateTimeInput(new Date().toISOString()),
      end: toDateTimeInput(row.current_period_end) || toDateTimeInput(addMonths(new Date(), 1).toISOString()),
      poolLimit: String(Math.max(row.total_pool_limit || 1, 1)),
      scanLimit: String(Math.max(row.total_scan_limit || 200, 200)),
    });
  }

  async function submitGrant() {
    if (!selectedUser) return;

    const poolLimit = Number(grantForm.poolLimit);
    const scanLimit = Number(grantForm.scanLimit);
    const start = new Date(grantForm.start);
    const end = new Date(grantForm.end);

    if (!Number.isFinite(poolLimit) || poolLimit < 1) {
      toast.error("מכסת הבריכות חייבת להיות לפחות 1");
      return;
    }

    if (!Number.isFinite(scanLimit) || scanLimit < 0) {
      toast.error("מכסת הסריקות לא תקינה");
      return;
    }

    if (!grantForm.start || !grantForm.end || end <= start) {
      toast.error("טווח התאריכים לא תקין");
      return;
    }

    setGranting(true);
    const { error } = await rpcClient.rpc("admin_grant_subscription", {
      p_account_id: selectedUser.account_id,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_pool_limit: poolLimit,
      p_scan_limit: scanLimit,
      p_plan_id: "basic_monthly",
    });

    if (error) {
      toast.error(`פתיחת המנוי נכשלה: ${error.message}`);
    } else {
      toast.success("המנוי עודכן בהצלחה");
      setSelectedUser(null);
      await loadDashboard({ quiet: true });
    }

    setGranting(false);
  }

  if (authLoading || adminLoading) {
    return <AdminLoading label="בודק הרשאות..." />;
  }

  if (!isAdmin) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 px-5 py-10">
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <Shield className="mx-auto h-12 w-12 text-slate-400" />
          <h1 className="mt-4 text-xl font-extrabold text-slate-900">אין לך הרשאת גישה</h1>
          <p className="mt-2 text-sm text-slate-500">הדשבורד מיועד למנהלי AquaSense בלבד.</p>
          <Link to="/" className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-cyan-700">
            <ArrowRight className="h-4 w-4" />
            חזרה לאפליקציה
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-cyan-700">
              <ArrowRight className="h-4 w-4" />
              חזרה לאפליקציה
            </Link>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-700">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">דשבורד ניהול משתמשים</h1>
                <p className="text-sm text-slate-500">צפייה בסריקות, מכסות ומנויים ידניים</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => loadDashboard({ quiet: true })}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-cyan-200 hover:text-cyan-700 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            רענן נתונים
          </button>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Users className="h-5 w-5" />} label="משתמשים" value={rows.length} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5" />} label="מנויים פעילים" value={stats.activeSubscriptions} />
          <StatCard icon={<ScanLine className="h-5 w-5" />} label="סריקות שנוצלו" value={stats.totalScans} />
          <StatCard icon={<ScanLine className="h-5 w-5" />} label="סריקות שנותרו" value={stats.totalRemaining} />
          <StatCard icon={<Waves className="h-5 w-5" />} label="בריכות פעילות" value={stats.activePools} />
        </section>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black">משתמשים וחשבונות</h2>
              <p className="text-sm text-slate-500">הנתונים מתעדכנים דרך Supabase ולא מפעילים סריקות או Gemini.</p>
            </div>
            <label className="relative block md:w-80">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="חפש לפי שם, אימייל או סטטוס"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pr-10 pl-3 text-sm outline-none transition focus:border-cyan-400 focus:bg-white"
              />
            </label>
          </div>

          {loading ? (
            <AdminLoading label="אוסף נתוני משתמשים..." compact />
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center">
              <AlertTriangle className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 font-bold text-slate-700">לא נמצאו משתמשים</p>
              <p className="text-sm text-slate-500">נסה לחפש אימייל או שם אחר.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <UserDashboardRow key={row.account_id} row={row} onGrant={() => openGrantDialog(row)} />
              ))}
            </div>
          )}
        </section>
      </main>

      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-4 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-black">פתיחת / עדכון מנוי</h3>
                <p className="text-sm text-slate-500">
                  {selectedUser.full_name || selectedUser.email || selectedUser.account_name || "משתמש"}
                </p>
              </div>
              <button
                onClick={() => setSelectedUser(null)}
                className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200"
                aria-label="סגור"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="מתאריך">
                <input
                  type="datetime-local"
                  value={grantForm.start}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, start: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-400"
                />
              </Field>
              <Field label="עד תאריך">
                <input
                  type="datetime-local"
                  value={grantForm.end}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, end: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-400"
                />
              </Field>
              <Field label="מכסת בריכות">
                <input
                  type="number"
                  min={1}
                  value={grantForm.poolLimit}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, poolLimit: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-400"
                />
              </Field>
              <Field label="מכסת סריקות לתקופה">
                <input
                  type="number"
                  min={0}
                  step={50}
                  value={grantForm.scanLimit}
                  onChange={(event) => setGrantForm((prev) => ({ ...prev, scanLimit: event.target.value }))}
                  className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-cyan-400"
                />
              </Field>
            </div>

            <div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-sm text-cyan-900">
              המערכת משתמשת בתוכנית הבסיסית ומוסיפה בריכות/חבילות סריקות לפי המספרים שתבחר. חבילות סריקה מעוגלות כלפי מעלה ל־200.
            </div>

            <button
              onClick={submitGrant}
              disabled={granting}
              className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 text-base font-black text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-700 disabled:opacity-60"
            >
              {granting && <Loader2 className="h-5 w-5 animate-spin" />}
              שמור מנוי
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function UserDashboardRow({ row, onGrant }: { row: AdminUserRow; onGrant: () => void }) {
  const activeSubscription = isSubscriptionActive(row);
  const scanPercent = row.total_scan_limit > 0 ? Math.min(100, Math.round((row.scans_billable / row.total_scan_limit) * 100)) : 0;
  const poolPercent = row.total_pool_limit > 0 ? Math.min(100, Math.round((row.pools_active_count / row.total_pool_limit) * 100)) : 0;

  return (
    <article className="grid gap-4 p-4 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-base font-black text-slate-900">
            {row.full_name || row.email || row.account_name || "משתמש ללא שם"}
          </h3>
          <StatusPill active={activeSubscription} status={row.subscription_status} provider={row.subscription_provider} />
        </div>
        <p className="truncate text-sm text-slate-500">{row.email || "אין אימייל בפרופיל"}</p>
        <p className="mt-1 text-xs text-slate-400">
          חשבון: {row.account_name || "ללא שם"} · הצטרף: {formatDate(row.joined_at)}
        </p>
      </div>

      <MetricBlock
        icon={<ScanLine className="h-4 w-4" />}
        title="סריקות"
        value={`${row.scans_remaining} נותרו`}
        description={`${row.scans_billable}/${row.total_scan_limit} נוצלו`}
        percent={scanPercent}
      />

      <MetricBlock
        icon={<Waves className="h-4 w-4" />}
        title="בריכות"
        value={`${row.pools_active_count}/${row.total_pool_limit}`}
        description={`${row.tests_count} סריקות, אחרונה ${formatDate(row.last_scan_at)}`}
        percent={poolPercent}
      />

      <div className="flex flex-col gap-2 lg:w-48">
        <button
          onClick={onGrant}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700"
        >
          <Crown className="h-4 w-4" />
          פתח מנוי
        </button>
        <p className="text-center text-xs text-slate-400">
          תוקף: {formatDate(row.current_period_start)} - {formatDate(row.current_period_end)}
        </p>
      </div>
    </article>
  );
}

function StatusPill({
  active,
  status,
  provider,
}: {
  active: boolean;
  status: string | null;
  provider: string | null;
}) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-700">
        <CheckCircle2 className="h-3.5 w-3.5" />
        מנוי פעיל {provider ? `(${provider})` : ""}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-700">
      <AlertTriangle className="h-3.5 w-3.5" />
      {status ? `לא פעיל (${status})` : "אין מנוי"}
    </span>
  );
}

function MetricBlock({
  icon,
  title,
  value,
  description,
  percent,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
  percent: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-black text-slate-500">
          {icon}
          {title}
        </span>
        <span className="text-sm font-black text-slate-900">{value}</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-cyan-500" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-500">{description}</p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-cyan-700">
        {icon}
        <span className="text-xs font-black text-slate-500">{label}</span>
      </div>
      <div className="mt-2 text-3xl font-black text-slate-900">{value.toLocaleString("he-IL")}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-black text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function AdminLoading({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <div dir="rtl" className={compact ? "flex items-center justify-center gap-3 p-10" : "flex min-h-screen items-center justify-center gap-3 bg-slate-50"}>
      <Loader2 className="h-6 w-6 animate-spin text-cyan-600" />
      <span className="text-sm font-bold text-slate-600">{label}</span>
    </div>
  );
}

function isSubscriptionActive(row: AdminUserRow) {
  if (!row.subscription_status) return false;
  if (["active", "trialing", "past_due"].includes(row.subscription_status)) {
    return !row.current_period_end || new Date(row.current_period_end) > new Date();
  }
  return row.subscription_status === "canceled" && !!row.current_period_end && new Date(row.current_period_end) > new Date();
}

function createDefaultGrantForm(): GrantForm {
  const now = new Date();
  return {
    start: toDateTimeInput(now.toISOString()),
    end: toDateTimeInput(addMonths(now, 1).toISOString()),
    poolLimit: "1",
    scanLimit: "200",
  };
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "אין נתון";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "אין נתון";
  return date.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
