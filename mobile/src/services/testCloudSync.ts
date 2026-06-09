// Mobile test/history cloud parity source:
// src/lib/cloudSync.ts, src/utils/storage.ts, src/routes/history.tsx,
// src/routes/results.$testId.tsx, src/components/ScanHistory.tsx.
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import type { Database, Json } from '../integrations/supabase/types';
import type { Pool } from '../domain/pool';
import type { SavedHistoryRecord } from '../state/ResultsHistoryContext';

type TestRow = Database['public']['Tables']['tests']['Row'];
type TestUpsert = Database['public']['Tables']['tests']['Insert'];

interface MobileTestResultsPayload {
  source: 'aquasense-mobile';
  schemaVersion: 1;
  record: SavedHistoryRecord;
  analysisResult: SavedHistoryRecord['analysisResult'];
  status: SavedHistoryRecord['status'];
  summary: SavedHistoryRecord['resultSummary'];
  brandId?: string;
  brandName?: string;
  poolName: string;
}

interface MobileTestRecommendationsPayload {
  source: 'aquasense-mobile';
  schemaVersion: 1;
  dosageResult: SavedHistoryRecord['dosageResult'];
  summary: string;
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id);
}

function newUuid() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function toMillis(value?: string | null) {
  if (!value) return undefined;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : undefined;
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(timestamp));
}

export function getTestCloudId(record: SavedHistoryRecord) {
  if (record.cloudId) return record.cloudId;
  if (isUuid(record.testId)) return record.testId;
  if (isUuid(record.id)) return record.id;
  return newUuid();
}

function getCloudPoolId(record: SavedHistoryRecord, pools: Pool[]) {
  if (!record.poolId) return undefined;
  const pool = pools.find((item) => item.id === record.poolId || item.cloudId === record.poolId);
  if (pool?.cloudId) return pool.cloudId;
  if (pool && isUuid(pool.id)) return pool.id;
  return isUuid(record.poolId) ? record.poolId : undefined;
}

function getLocalPoolId(remotePoolId: string, pools: Pool[]) {
  return pools.find((pool) => pool.cloudId === remotePoolId || pool.id === remotePoolId)?.id ?? remotePoolId;
}

function isMobileResultsPayload(value: unknown): value is MobileTestResultsPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'source' in value &&
      (value as { source?: unknown }).source === 'aquasense-mobile' &&
      'record' in value,
  );
}

function isMobileRecommendationsPayload(value: unknown): value is MobileTestRecommendationsPayload {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'source' in value &&
      (value as { source?: unknown }).source === 'aquasense-mobile',
  );
}

export function mapCloudTestToLocal(row: TestRow, pools: Pool[]): SavedHistoryRecord {
  const testedAt = toMillis(row.tested_at) ?? toMillis(row.created_at) ?? Date.now();
  const resultsPayload = row.results as unknown;
  const recommendationsPayload = row.recommendations as unknown;
  const baseRecord = isMobileResultsPayload(resultsPayload) ? resultsPayload.record : undefined;
  const dosagePayload = isMobileRecommendationsPayload(recommendationsPayload) ? recommendationsPayload.dosageResult : undefined;
  const poolId = baseRecord?.poolId ?? getLocalPoolId(row.pool_id, pools);
  const pool = pools.find((item) => item.id === poolId || item.cloudId === row.pool_id);

  return {
    id: baseRecord?.id ?? row.id,
    testId: baseRecord?.testId ?? row.id,
    cloudId: row.id,
    date: baseRecord?.date ?? formatDateTime(testedAt),
    poolId,
    poolName: baseRecord?.poolName ?? pool?.name ?? 'הבריכה שלי',
    brandId: baseRecord?.brandId,
    brandName: baseRecord?.brandName,
    imageUri: baseRecord?.imageUri ?? row.image_url ?? undefined,
    resultSummary: baseRecord?.resultSummary ?? 'תוצאת בדיקה שמורה',
    status: baseRecord?.status ?? 'המים מאוזנים',
    tone: baseRecord?.tone ?? 'success',
    testedAt,
    createdAt: baseRecord?.createdAt ?? toMillis(row.created_at) ?? testedAt,
    updatedAt: baseRecord?.updatedAt ?? testedAt,
    analysisResult: baseRecord?.analysisResult ?? (isMobileResultsPayload(resultsPayload) ? resultsPayload.analysisResult : undefined),
    dosageResult: baseRecord?.dosageResult ?? dosagePayload,
  };
}

export function mapLocalTestToCloud(record: SavedHistoryRecord, userId: string, pools: Pool[]): TestUpsert | undefined {
  const poolId = getCloudPoolId(record, pools);
  if (!poolId) return undefined;

  const cloudId = getTestCloudId(record);
  const normalizedRecord: SavedHistoryRecord = {
    ...record,
    cloudId,
    updatedAt: record.updatedAt ?? record.createdAt ?? record.testedAt,
  };

  const resultsPayload: MobileTestResultsPayload = {
    source: 'aquasense-mobile',
    schemaVersion: 1,
    record: normalizedRecord,
    analysisResult: normalizedRecord.analysisResult,
    status: normalizedRecord.status,
    summary: normalizedRecord.resultSummary,
    brandId: normalizedRecord.brandId,
    brandName: normalizedRecord.brandName,
    poolName: normalizedRecord.poolName,
  };

  const recommendationsPayload: MobileTestRecommendationsPayload = {
    source: 'aquasense-mobile',
    schemaVersion: 1,
    dosageResult: normalizedRecord.dosageResult,
    summary: normalizedRecord.dosageResult?.summary ?? normalizedRecord.resultSummary,
  };

  return {
    id: cloudId,
    user_id: userId,
    pool_id: poolId,
    results: toJson(resultsPayload),
    recommendations: toJson(recommendationsPayload),
    image_url: normalizedRecord.imageUri ?? null,
    tested_at: new Date(normalizedRecord.testedAt).toISOString(),
    created_at: new Date(normalizedRecord.createdAt).toISOString(),
  };
}

export async function fetchCloudTests(userId: string, pools: Pool[]): Promise<SavedHistoryRecord[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getSupabaseClient()
    .from('tests')
    .select('*')
    .eq('user_id', userId)
    .order('tested_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapCloudTestToLocal(row, pools));
}

export async function upsertTestToCloud(record: SavedHistoryRecord, userId: string, pools: Pool[]): Promise<SavedHistoryRecord | undefined> {
  if (!isSupabaseConfigured) return record;

  const upsert = mapLocalTestToCloud(record, userId, pools);
  if (!upsert) return undefined;

  const { error } = await getSupabaseClient().from('tests').upsert(upsert);
  if (error) throw error;

  return {
    ...record,
    cloudId: upsert.id,
    updatedAt: record.updatedAt ?? record.createdAt ?? record.testedAt,
  };
}

function testSyncKey(record: SavedHistoryRecord) {
  return record.cloudId ?? (isUuid(record.testId) ? record.testId : undefined);
}

export interface TestSyncResult {
  records: SavedHistoryRecord[];
  pushedCount: number;
  pulledCount: number;
}

// Simple conflict strategy for this first history-sync slice:
// keep local AsyncStorage visible immediately, fetch cloud tests after auth, and
// prefer the record with the newest updatedAt/testedAt. Images are not uploaded
// here; imageUri/image_url stores only the existing local URI/path when present.
export async function syncTestsWithCloud(
  localRecords: SavedHistoryRecord[],
  user: User,
  pools: Pool[],
): Promise<TestSyncResult> {
  if (!isSupabaseConfigured) {
    return { records: localRecords, pushedCount: 0, pulledCount: 0 };
  }

  const remoteRecords = await fetchCloudTests(user.id, pools);
  const remoteByCloudId = new Map(remoteRecords.map((record) => [record.cloudId ?? record.testId, record]));
  const merged: SavedHistoryRecord[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  for (const localRecord of localRecords) {
    const cloudId = testSyncKey(localRecord);
    const remoteRecord = cloudId ? remoteByCloudId.get(cloudId) : undefined;

    if (!remoteRecord) {
      const pushed = await upsertTestToCloud(localRecord, user.id, pools);
      if (pushed) {
        pushedCount += 1;
        merged.push(pushed);
        if (pushed.cloudId) remoteByCloudId.delete(pushed.cloudId);
      } else {
        merged.push(localRecord);
      }
      continue;
    }

    remoteByCloudId.delete(remoteRecord.cloudId ?? remoteRecord.testId);
    const localUpdatedAt = localRecord.updatedAt ?? localRecord.testedAt ?? localRecord.createdAt;
    const remoteUpdatedAt = remoteRecord.updatedAt ?? remoteRecord.testedAt ?? remoteRecord.createdAt;

    if (localUpdatedAt >= remoteUpdatedAt) {
      const pushed = await upsertTestToCloud({ ...localRecord, cloudId: remoteRecord.cloudId ?? remoteRecord.testId }, user.id, pools);
      if (pushed) {
        pushedCount += 1;
        merged.push(pushed);
      } else {
        merged.push(localRecord);
      }
    } else {
      pulledCount += 1;
      merged.push({
        ...remoteRecord,
        id: localRecord.id,
        testId: localRecord.testId,
        cloudId: remoteRecord.cloudId ?? remoteRecord.testId,
      });
    }
  }

  for (const remoteRecord of remoteByCloudId.values()) {
    pulledCount += 1;
    merged.push(remoteRecord);
  }

  const unique = new Map<string, SavedHistoryRecord>();
  for (const record of merged) {
    unique.set(record.cloudId ?? record.testId, record);
  }

  const records = Array.from(unique.values()).sort((a, b) => b.testedAt - a.testedAt);
  return { records, pushedCount, pulledCount };
}
