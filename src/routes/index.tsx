import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, Menu, Droplet, CheckCircle2, ScanLine, ChevronLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { poolStorage, type Pool, type TestRecord } from "@/utils/storage";
import { BottomTabBar } from "@/components/BottomTabBar";
import poolBg from "@/assets/pool-bg.jpg.asset.json";


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
  const { isAuthenticated, loading, user } = useAuth();
  const navigate = useNavigate();
  const [pools, setPools] = useState<Pool[]>([]);
  const [latest, setLatest] = useState<TestRecord | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate({ to: "/welcome" });
  }, [loading, isAuthenticated, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setPools(poolStorage.list());
    const tests = JSON.parse(localStorage.getItem("poolcheck.tests") || "[]") as TestRecord[];
    if (tests.length) {
      tests.sort((a, b) => b.date - a.date);
      setLatest(tests[0]);
    }
  }, []);

  const firstName = useMemo(() => {
    const n = user?.user_metadata?.display_name || user?.email || "";
    return String(n).split(/[\s@]/)[0];
  }, [user]);

  if (loading || !isAuthenticated) {
    return <div className="min-h-screen bg-background" />;
  }

  const stats = readStats(latest);
  const allOk = stats.every((s) => s.status === "ok");

  return (
    <div dir="rtl" className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#E6F4FB] via-[#F4FAFD] to-background">
      {/* Pool water strip behind the card */}
      <div className="pointer-events-none absolute inset-x-0 top-[180px] h-[260px] overflow-hidden">
        <img
          src={poolBg.url}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background" />
      </div>

      <div className="relative mx-auto max-w-md px-5 pt-5">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <Link
            to="/history"
            aria-label="היסטוריה"
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:scale-95"
          >
            <Bell className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-1.5">
            <Droplet className="h-5 w-5 text-primary" fill="currentColor" />
            <span className="text-lg font-extrabold">
              <span className="text-primary">Aqua</span>
              <span className="text-foreground">Sense</span>
            </span>
          </div>
          <Link
            to="/settings"
            aria-label="הגדרות"
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground active:scale-95"
          >
            <Menu className="h-5 w-5" />
          </Link>
        </div>

        {/* Greeting */}
        <div className="mt-5 text-center">
          <h1 className="text-3xl font-black text-foreground">
            שלום{firstName ? ` ${firstName}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">כיף לראות אותך שוב</p>
        </div>

        {/* Water status card */}
        <div className="mt-6 rounded-[28px] bg-card p-5 shadow-[0_20px_50px_-20px_rgba(8,145,178,0.25)]">
          <div className="text-center text-sm font-bold text-muted-foreground">מצב המים</div>
          <div className="mt-4 flex justify-center">
            <div className={`flex h-20 w-20 items-center justify-center rounded-full ${allOk ? "bg-emerald-100" : "bg-amber-100"}`}>
              <CheckCircle2 className={`h-12 w-12 ${allOk ? "text-emerald-500" : "text-amber-500"}`} strokeWidth={2.5} />
            </div>
          </div>
          <div className="mt-3 text-center">
            <div className="text-xl font-black text-foreground">
              {latest ? (allOk ? "רוב הערכים תקינים" : "נדרש תיקון קל") : "אין בדיקה אחרונה"}
            </div>
            <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold text-muted-foreground">
              <Droplet className="h-3.5 w-3.5 text-primary" />
              {latest ? "המים שלך נקיים ובריאים" : "בצע סריקה כדי לראות את מצב המים"}
            </div>
          </div>

          {/* Stat row */}
          <div className="mt-5 grid grid-cols-3 gap-2.5">
            {stats.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </div>
        </div>

        {/* CTA */}
        <Link
          to="/select-strip"
          className="mt-6 flex items-center justify-center gap-3 rounded-full px-6 py-5 text-lg font-black text-primary-foreground shadow-[0_12px_30px_-10px_rgba(8,145,178,0.55)] transition active:scale-[0.98]"
          style={{ background: "var(--gradient-hero)" }}
        >
          <ScanLine className="h-6 w-6" />
          התחל סריקה
        </Link>
      </div>

      <BottomTabBar />
    </div>
  );
}

function StatTile({ label, value, status }: StatRead) {
  const text =
    status === "ok" ? "תקין" : status === "low" ? "נמוך" : "גבוה";
  const textTone =
    status === "ok" ? "text-emerald-600" : status === "low" ? "text-amber-600" : "text-rose-600";
  return (
    <div className="rounded-2xl bg-white px-2 py-3 text-center shadow-[0_2px_8px_-2px_rgba(8,145,178,0.12)]">
      <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-2xl font-black text-primary">{value ?? "—"}</div>
      <div className={`text-[11px] font-extrabold ${textTone}`}>{text}</div>
    </div>
  );
}

interface StatRead {
  label: string;
  value: string | null;
  status: "ok" | "low" | "high";
}

function readStats(test: TestRecord | null): StatRead[] {
  const get = (k: string) => {
    const r = (test?.results as Record<string, { value: number; status: "ok" | "low" | "high" } | undefined> | undefined)?.[k];
    return r ? { value: r.value, status: r.status } : null;
  };
  const ph = get("ph");
  const cl = get("freeChlorine");
  const alk = get("alkalinity");
  return [
    { label: "אלקליניות", value: alk ? String(Math.round(alk.value)) : null, status: alk?.status ?? "ok" },
    { label: "כלור", value: cl ? cl.value.toFixed(1) : null, status: cl?.status ?? "ok" },
    { label: "pH", value: ph ? ph.value.toFixed(1) : null, status: ph?.status ?? "ok" },
  ];
}
