// Sync layer between local cache (localStorage) and Supabase cloud.
// For authenticated users, cloud is source of truth; localStorage acts as cache
// so the existing sync poolStorage/testStorage APIs keep working unchanged.
import { supabase } from "@/integrations/supabase/client";
import type { Pool, TestRecord } from "@/utils/storage";

const POOLS_KEY = "poolcheck.pools";
const TESTS_KEY = "poolcheck.tests";

function writeLocal<T>(key: string, val: T[]) {
  if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(val));
}

export function clearLocalCache() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(POOLS_KEY);
  localStorage.removeItem(TESTS_KEY);
}

export async function syncFromCloud() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  const [{ data: pools }, { data: tests }] = await Promise.all([
    supabase.from("pools").select("*").order("created_at", { ascending: false }),
    supabase.from("tests").select("*").order("tested_at", { ascending: false }),
  ]);

  const localPools: Pool[] = (pools ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type as "chlorine" | "salt",
    volumeLiters: p.volume_liters,
    stripBrandId: p.strip_brand_id ?? undefined,
    createdAt: new Date(p.created_at).getTime(),
    lastTestAt: p.last_test_at ? new Date(p.last_test_at).getTime() : undefined,
  }));

  const localTests: TestRecord[] = (tests ?? []).map((t) => ({
    id: t.id,
    poolId: t.pool_id,
    date: new Date(t.tested_at).getTime(),
    results: t.results as unknown as TestRecord["results"],
    recommendations: (t.recommendations as unknown as TestRecord["recommendations"]) ?? [],
    imageDataUrl: t.image_url ?? undefined,
  }));

  writeLocal(POOLS_KEY, localPools);
  writeLocal(TESTS_KEY, localTests);
}

export async function pushPool(pool: Pool) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("pools").upsert({
    id: pool.id,
    user_id: u.user.id,
    name: pool.name,
    type: pool.type,
    volume_liters: pool.volumeLiters,
    strip_brand_id: pool.stripBrandId ?? null,
    last_test_at: pool.lastTestAt ? new Date(pool.lastTestAt).toISOString() : null,
  });
}

export async function pushTest(test: TestRecord) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("tests").insert([{
    user_id: u.user.id,
    pool_id: test.poolId,
    results: test.results as never,
    recommendations: test.recommendations as never,
    image_url: test.imageDataUrl ?? null,
    tested_at: new Date(test.date).toISOString(),
  }]);
}

export async function deletePoolCloud(id: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("pools").delete().eq("id", id);
}

export function isAuthedSync(): boolean {
  if (typeof window === "undefined") return false;
  // Quick check via localStorage supabase session; fine for fire-and-forget pushes
  try {
    const keys = Object.keys(localStorage);
    return keys.some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return false;
  }
}
