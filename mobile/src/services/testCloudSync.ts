// Mobile test/history cloud parity source:
// src/lib/cloudSync.ts, src/utils/storage.ts, src/routes/history.tsx,
// src/routes/results.$testId.tsx, src/components/ScanHistory.tsx.
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import type { Database, Json } from '../integrations/supabase/types';
import type { ScanResultParameter } from '../domain/scanResults';
import type { Pool } from '../domain/pool';
import type { SavedHistoryRecord } from '../state/ResultsHistoryContext';
import { getPublicScanImageUrl, uploadScanImage } from './scanImageStorage';

type TestRow = Database['public']['Tables']['tests']['Row'];
type TestUpsert = Database['public']['Tables']['tests']['Insert'];
type TestReadingInsert = Database['public']['Tables']['test_readings']['Insert'];
type TestRecommendationInsert = Database['public']['Tables']['test_recommendations']['Insert'];

interface MobileTestResultsPayload {
  source: 'aquasense-mobile';
  schemaVersion: 2;
  record: SavedHistoryRecord;
  analysisResult: SavedHistoryRecord['analysisResult'];
  status: SavedHistoryRecord['status'];
  summary: SavedHistoryRecord['resultSummary'];
  brandId?: string;
  brandName?: string;
  imagePath?: string;
  imageUrl?: string;
  poolName: string;
}

function isUuid(id?: string | null) {
  return Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(id));
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
  if (isUuid(pool?.id)) return pool?.id;
  return isUuid(record.poolId) ? record.poolId : undefined;
}

function getLocalPoolId(remotePoolId: string | null, pools: Pool[]) {
  if (!remotePoolId) return undefined;
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

export function mapCloudTestToLocal(row: TestRow, pools: Pool[]): SavedHistoryRecord {
  const testedAt = toMillis(row.analyzed_at) ?? toMillis(row.created_at) ?? Date.now();
  const resultsPayload = row.raw_result as unknown;
  const baseRecord = isMobileResultsPayload(resultsPayload) ? resultsPayload.record : undefined;
  const poolId = baseRecord?.poolId ?? getLocalPoolId(row.pool_id, pools);
  const pool = pools.find((item) => item.id === poolId || item.cloudId === row.pool_id);
  const imagePath = baseRecord?.imagePath ?? row.image_path ?? undefined;
  const imageUrl = baseRecord?.imageUrl ?? row.image_url ?? (imagePath ? getPublicScanImageUrl(imagePath) : undefined);

  return {
    id: baseRecord?.id ?? row.id,
    testId: baseRecord?.testId ?? row.id,
    cloudId: row.id,
    accountId: row.account_id,
    date: baseRecord?.date ?? formatDateTime(testedAt),
    poolId,
    poolName: baseRecord?.poolName ?? pool?.name ?? 'הבריכה שלי',
    brandId: baseRecord?.brandId ?? row.strip_brand_id ?? undefined,
    brandName: baseRecord?.brandName,
    imageUri: baseRecord?.imageUri,
    imagePath,
    imageUrl,
    imageUploadError: baseRecord?.imageUploadError ?? row.error_message ?? undefined,
    resultSummary: baseRecord?.resultSummary ?? row.recommendation ?? 'תוצאת בדיקה שמורה',
    status: baseRecord?.status ?? row.overall_status ?? 'המים מאוזנים',
    tone: baseRecord?.tone ?? (row.overall_status === 'נדרש תיקון קל' ? 'warning' : 'success'),
    testedAt,
    createdAt: baseRecord?.createdAt ?? toMillis(row.created_at) ?? testedAt,
    updatedAt: baseRecord?.updatedAt ?? toMillis(row.updated_at) ?? testedAt,
    analysisResult: baseRecord?.analysisResult ?? undefined,
    dosageResult: baseRecord?.dosageResult ?? baseRecord?.analysisResult?.dosage,
  };
}

export function mapLocalTestToCloud(
  record: SavedHistoryRecord,
  userId: string,
  accountId: string,
  pools: Pool[],
): TestUpsert {
  const cloudId = getTestCloudId(record);
  const normalizedRecord: SavedHistoryRecord = {
    ...record,
    accountId,
    cloudId,
    updatedAt: record.updatedAt ?? record.createdAt ?? record.testedAt,
  };

  const resultsPayload: MobileTestResultsPayload = {
    source: 'aquasense-mobile',
    schemaVersion: 2,
    record: normalizedRecord,
    analysisResult: normalizedRecord.analysisResult,
    status: normalizedRecord.status,
    summary: normalizedRecord.resultSummary,
    brandId: normalizedRecord.brandId,
    brandName: normalizedRecord.brandName,
    imagePath: normalizedRecord.imagePath,
    imageUrl: normalizedRecord.imageUrl,
    poolName: normalizedRecord.poolName,
  };

  return {
    id: cloudId,
    account_id: accountId,
    user_id: userId,
    pool_id: getCloudPoolId(normalizedRecord, pools) ?? null,
    strip_brand_id: normalizedRecord.brandId ?? null,
    image_path: normalizedRecord.imagePath ?? null,
    image_url: normalizedRecord.imageUrl ?? null,
    analysis_status: normalizedRecord.analysisResult ? 'completed' : 'pending',
    source: normalizedRecord.analysisResult?.source ?? null,
    provider: normalizedRecord.analysisResult?.provider ?? null,
    model: normalizedRecord.analysisResult?.model ?? null,
    confidence: normalizedRecord.analysisResult?.confidence ?? null,
    low_confidence: normalizedRecord.analysisResult?.lowConfidence ?? false,
    overall_status: normalizedRecord.status,
    recommendation: normalizedRecord.dosageResult?.summary ?? normalizedRecord.resultSummary,
    raw_result: toJson(resultsPayload),
    error_message: normalizedRecord.imageUploadError ?? null,
    is_billable: normalizedRecord.analysisResult?.source !== 'mock',
    analyzed_at: new Date(normalizedRecord.testedAt).toISOString(),
    created_at: new Date(normalizedRecord.createdAt).toISOString(),
    updated_at: new Date(normalizedRecord.updatedAt ?? normalizedRecord.createdAt).toISOString(),
  };
}

function mapParameterToReading(parameter: ScanResultParameter, testId: string, accountId: string): TestReadingInsert {
  return {
    account_id: accountId,
    confidence: null,
    label: parameter.name,
    max_value: parameter.idealRange.max,
    min_value: parameter.idealRange.min,
    parameter_key: parameter.key,
    raw: toJson(parameter),
    status: parameter.status.kind,
    test_id: testId,
    unit: parameter.unit,
    value: parameter.value,
  };
}

async function upsertReadingsToCloud(record: SavedHistoryRecord, testId: string, accountId: string) {
  const parameters = record.analysisResult?.parameters ?? [];
  if (!parameters.length) return;

  const { error } = await getSupabaseClient()
    .from('test_readings')
    .upsert(parameters.map((parameter) => mapParameterToReading(parameter, testId, accountId)), {
      onConflict: 'test_id,parameter_key',
    });

  if (error) throw error;
}

async function upsertRecommendationsToCloud(record: SavedHistoryRecord, testId: string, accountId: string) {
  await getSupabaseClient().from('test_recommendations').delete().eq('test_id', testId);

  const recommendations = record.dosageResult?.recommendations ?? [];
  const rows: TestRecommendationInsert[] = recommendations.length
    ? recommendations.map((recommendation, index) => ({
        account_id: accountId,
        action_type: recommendation.status,
        amount: recommendation.product?.amount ?? null,
        description: recommendation.actionHe,
        parameter_key: recommendation.paramKey,
        priority: index,
        product_type: recommendation.product?.key,
        raw: toJson(recommendation),
        safety_note: record.dosageResult?.safetyNote ?? null,
        test_id: testId,
        title: recommendation.labelHe,
        unit: recommendation.product?.unit ?? recommendation.unit ?? null,
      }))
    : [
        {
          account_id: accountId,
          action_type: 'summary',
          description: record.dosageResult?.summary ?? record.resultSummary,
          priority: 0,
          raw: toJson(record.dosageResult ?? {}),
          test_id: testId,
          title: 'המלצה',
        },
      ];

  const { error } = await getSupabaseClient().from('test_recommendations').insert(rows);
  if (error) throw error;
}

export async function fetchCloudTests(accountId: string, pools: Pool[]): Promise<SavedHistoryRecord[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await getSupabaseClient()
    .from('tests')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapCloudTestToLocal(row, pools));
}

export async function upsertTestToCloud(
  record: SavedHistoryRecord,
  userId: string,
  accountId: string,
  pools: Pool[],
): Promise<SavedHistoryRecord | undefined> {
  if (!isSupabaseConfigured) return record;

  const cloudId = getTestCloudId(record);
  let recordForCloud: SavedHistoryRecord = {
    ...record,
    accountId,
    cloudId,
    updatedAt: record.updatedAt ?? record.createdAt ?? record.testedAt,
  };

  if (recordForCloud.imageUri && !recordForCloud.imagePath && !recordForCloud.imageUrl) {
    try {
      const uploadedImage = await uploadScanImage({
        accountId,
        imageUri: recordForCloud.imageUri,
        testId: cloudId,
        userId,
      });

      if (uploadedImage) {
        recordForCloud = {
          ...recordForCloud,
          imagePath: uploadedImage.path,
          imageUrl: uploadedImage.publicUrl,
          imageUploadError: undefined,
          updatedAt: Date.now(),
        };
      }
    } catch (error) {
      console.warn('Failed to upload scan image to storage', error);
      recordForCloud = {
        ...recordForCloud,
        imageUploadError: 'העלאת תמונת הסטיק לענן נכשלה. הבדיקה נשמרה עם התמונה המקומית.',
        updatedAt: Date.now(),
      };
    }
  }

  const { data: existingTest } = await getSupabaseClient()
    .from('tests')
    .select('id')
    .eq('id', cloudId)
    .maybeSingle();

  const upsert = mapLocalTestToCloud(recordForCloud, userId, accountId, pools);
  const { error } = await getSupabaseClient().from('tests').upsert(upsert);
  if (error) throw error;

  await upsertReadingsToCloud(recordForCloud, cloudId, accountId);
  await upsertRecommendationsToCloud(recordForCloud, cloudId, accountId);

  if (!existingTest) {
    await getSupabaseClient().rpc('register_scan_usage', {
      p_account_id: accountId,
      p_test_id: cloudId,
      p_user_id: userId,
    });
  }

  return {
    ...recordForCloud,
    cloudId: upsert.id,
    updatedAt: recordForCloud.updatedAt ?? recordForCloud.createdAt ?? recordForCloud.testedAt,
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

// Simple conflict strategy for this history-sync slice:
// keep local AsyncStorage visible immediately, fetch cloud tests after auth, and
// prefer the record with the newest updatedAt/testedAt. Usage registration is
// added only when a cloud test is first created to avoid duplicate counters.
export async function syncTestsWithCloud(
  localRecords: SavedHistoryRecord[],
  user: User,
  accountId: string,
  pools: Pool[],
): Promise<TestSyncResult> {
  if (!isSupabaseConfigured) {
    return { records: localRecords, pushedCount: 0, pulledCount: 0 };
  }

  const remoteRecords = await fetchCloudTests(accountId, pools);
  const remoteByCloudId = new Map(remoteRecords.map((record) => [record.cloudId ?? record.testId, record]));
  const merged: SavedHistoryRecord[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  for (const localRecord of localRecords) {
    const cloudId = testSyncKey(localRecord);
    const remoteRecord = cloudId ? remoteByCloudId.get(cloudId) : undefined;

    if (!remoteRecord) {
      const pushed = await upsertTestToCloud(localRecord, user.id, accountId, pools);
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
      const pushed = await upsertTestToCloud({ ...localRecord, cloudId: remoteRecord.cloudId ?? remoteRecord.testId }, user.id, accountId, pools);
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
