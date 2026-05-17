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

// Convert dataURL to Blob for upload
function dataUrlToBlob(dataUrl: string): Blob | null {
  try {
    const [meta, b64] = dataUrl.split(",");
    const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/jpeg";
    const bin = atob(b64);
    const len = bin.length;
    const arr = new Uint8Array(len);
    for (let i = 0; i < len; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  } catch {
    return null;
  }
}

async function uploadScanImage(userId: string, testId: string, dataUrl: string): Promise<string | null> {
  const blob = dataUrlToBlob(dataUrl);
  if (!blob) return null;
  const ext = blob.type.includes("png") ? "png" : "jpg";
  const path = `${userId}/${testId}.${ext}`;
  const { error } = await supabase.storage.from("scan-images").upload(path, blob, {
    upsert: true,
    contentType: blob.type,
  });
  if (error) {
    console.error("scan image upload failed", error);
    return null;
  }
  return path;
}

export async function pushTest(test: TestRecord) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;

  let imagePath: string | null = null;
  if (test.imageDataUrl && test.imageDataUrl.startsWith("data:")) {
    imagePath = await uploadScanImage(u.user.id, test.id, test.imageDataUrl);
  } else if (test.imageDataUrl) {
    imagePath = test.imageDataUrl;
  }

  await supabase.from("tests").insert([{
    id: test.id,
    user_id: u.user.id,
    pool_id: test.poolId,
    results: test.results as never,
    recommendations: test.recommendations as never,
    image_url: imagePath,
    tested_at: new Date(test.date).toISOString(),
  }]);

  // Increment free_scans_used counter
  const { data: profile } = await supabase
    .from("profiles")
    .select("free_scans_used")
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (profile) {
    await supabase
      .from("profiles")
      .update({ free_scans_used: (profile.free_scans_used ?? 0) + 1 })
      .eq("user_id", u.user.id);
  }
}

export async function deletePoolCloud(id: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from("pools").delete().eq("id", id);
}

export function isAuthedSync(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const keys = Object.keys(localStorage);
    return keys.some((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
  } catch {
    return false;
  }
}
