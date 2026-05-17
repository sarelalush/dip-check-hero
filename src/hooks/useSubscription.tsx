import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPaddleEnvironment } from "@/lib/paddle";

interface SubscriptionRow {
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  quantity: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
}

interface SubscriptionState {
  loading: boolean;
  hasBasePlan: boolean;
  extraPools: number; // quantity of extra pools addon (each addon item counts as 1 extra)
  allowedPools: number; // 0 if no base, otherwise 1 + extraPools
  rows: SubscriptionRow[];
  freeScansUsed: number;
  freeScansRemaining: number;
  isAdmin: boolean;
  isEarlyBird: boolean;
  isPaying: boolean; // has an actual paid subscription
  refetch: () => Promise<void>;
}

const FREE_SCAN_LIMIT = 3;

function isRowActive(row: SubscriptionRow): boolean {
  const endsAt = row.current_period_end ? new Date(row.current_period_end).getTime() : null;
  const now = Date.now();
  if (["active", "trialing", "past_due"].includes(row.status)) {
    return endsAt === null || endsAt > now;
  }
  if (row.status === "canceled") {
    return endsAt !== null && endsAt > now;
  }
  return false;
}

export function useSubscription(): SubscriptionState {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SubscriptionRow[]>([]);
  const [freeScansUsed, setFreeScansUsed] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isEarlyBird, setIsEarlyBird] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!user) {
      setRows([]);
      setFreeScansUsed(0);
      setIsAdmin(false);
      setIsEarlyBird(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const env = getPaddleEnvironment();
    const [{ data: subs }, { data: prof }, { data: adminRow }, { data: earlyBird }] = await Promise.all([
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("free_scans_used")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle(),
      supabase.rpc("is_early_bird_free", { user_uuid: user.id }),
    ]);
    setRows((subs as unknown as SubscriptionRow[]) || []);
    setFreeScansUsed((prof?.free_scans_used as number) ?? 0);
    setIsAdmin(!!adminRow);
    setIsEarlyBird(!!earlyBird);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => fetchAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  const activeRows = rows.filter(isRowActive);
  const isPaying = activeRows.some((r) => r.product_id === "pool_base_plan");
  const hasBasePlan = isPaying || isAdmin || isEarlyBird;
  const extraPools = hasBasePlan
    ? activeRows
        .filter((r) => r.product_id === "pool_extra_addon")
        .reduce((s, r) => s + (r.quantity || 0), 0)
    : 0;
  const allowedPools = isAdmin
    ? 999
    : hasBasePlan
      ? 1 + extraPools
      : 0;
  const freeScansRemaining = Math.max(0, FREE_SCAN_LIMIT - freeScansUsed);

  return {
    loading,
    hasBasePlan,
    extraPools,
    allowedPools,
    rows,
    freeScansUsed,
    freeScansRemaining,
    isAdmin,
    isEarlyBird,
    isPaying,
    refetch: fetchAll,
  };
}

export async function incrementFreeScan(userId: string): Promise<number> {
  const { data: prof } = await supabase
    .from("profiles")
    .select("free_scans_used")
    .eq("user_id", userId)
    .maybeSingle();
  const current = (prof?.free_scans_used as number) ?? 0;
  const next = current + 1;
  await supabase.from("profiles").update({ free_scans_used: next }).eq("user_id", userId);
  return next;
}

export const FREE_SCAN_TOTAL = FREE_SCAN_LIMIT;
