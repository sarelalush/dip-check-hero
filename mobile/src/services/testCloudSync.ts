// Mobile test/history cloud parity source:
// src/lib/cloudSync.ts, src/utils/storage.ts, src/routes/history.tsx,
// src/routes/results.$testId.tsx, src/components/ScanHistory.tsx.
import type { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import type { Database, Json } from '../integrations/supabase/types';
import type { ScanResultParameter, StripAnalysisResult } from '../domain/scanResults';
import type { Pool } from '../domain/pool';
import type { SavedHistoryRecord } from '../state/ResultsHistoryContext';
import { getPublicScanImageUrl, uploadScanImage } from './scanImageStorage';

type TestRow = Database['public']['Tables']['tests']['Row'];
type TestUpsert = Database['public']['Tables']['tests']['Insert'];
type TestReadingInsert = Database['public']['Tables']['test_readings']['Insert'];
type TestRecommendationInsert = Database['public']['Tables']['test_recommendations']['Insert'];

const TEST_HISTORY_LIMIT = 200;
const FULL_TEST_SELECT =
  'id,account_id,user_id,pool_id,strip_brand_id,image_path,image_url,analysis_status,source,provider,model,confidence,low_confidence,overall_status,recommendation,raw_result,error_message,is_billable,analyzed_at,created_at,updated_at';
const SUMMARY_TEST_SELECT =
  'id,account_id,user_id,pool_id,strip_brand_id,image_path,image_url,analysis_status,source,provider,model,confidence,low_confidence,overall_status,recommendation,error_message,is_billable,analyzed_at,created_at,updated_at';

interface MobileTestResultsPayload {
  source: 'aquasense-mobile';
  schemaVersion: 2;
  record: SavedHistoryRecord;
  analysisResult: SavedHistoryRecord['analysisResult'];
  dosageResult?: SavedHistoryRecord['dosageResult'];
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

function deterministicUuidFromString(value: string) {
  let hash = 2166136261;
  const hex = Array.from(value).map((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
    return (hash >>> 0).toString(16).padStart(8, '0');
  }).join('');
  const padded = `${hex}${'0'.repeat(32)}`.slice(0, 32).split('');
  padded[12] = '4';
  padded[16] = ((Number.parseInt(padded[16], 16) & 0x3) | 0x8).toString(16);
  return `${padded.slice(0, 8).join('')}-${padded.slice(8, 12).join('')}-${padded.slice(12, 16).join('')}-${padded.slice(16, 20).join('')}-${padded.slice(20, 32).join('')}`;
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
  if (record.testId) return deterministicUuidFromString(record.testId);
  if (record.id) return deterministicUuidFromString(record.id);
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

function isStripAnalysisResult(value: unknown): value is StripAnalysisResult {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'id' in value &&
      'parameters' in value &&
      Array.isArray((value as { parameters?: unknown }).parameters) &&
      'overallStatus' in value,
  );
}

export function mapCloudTestToLocal(row: TestRow, pools: Pool[]): SavedHistoryRecord {
  const testedAt = toMillis(row.analyzed_at) ?? toMillis(row.created_at) ?? Date.now();
  const resultsPayload = row.raw_result as unknown;
  const baseRecord = isMobileResultsPayload(resultsPayload) ? resultsPayload.record : undefined;
  const payloadAnalysisResult = isMobileResultsPayload(resultsPayload) ? resultsPayload.analysisResult : undefined;
  const payloadDosageResult = isMobileResultsPayload(resultsPayload) ? resultsPayload.dosageResult : undefined;
  const directAnalysisResult = isStripAnalysisResult(resultsPayload) ? resultsPayload : undefined;
  const localPoolId = getLocalPoolId(row.pool_id, pools);
  const basePool = baseRecord?.poolId
    ? pools.find((item) => item.id === baseRecord.poolId || item.cloudId === baseRecord.poolId)
    : undefined;
  const poolId = localPoolId ?? basePool?.id ?? baseRecord?.poolId;
  const pool = pools.find((item) => item.id === poolId || item.cloudId === row.pool_id || item.cloudId === baseRecord?.poolId);
  const imagePath = baseRecord?.imagePath ?? row.image_path ?? undefined;
  const imageUrl = baseRecord?.imageUrl ?? row.image_url ?? (imagePath ? getPublicScanImageUrl(imagePath) : undefined);
  const analysisResult = baseRecord?.analysisResult ?? payloadAnalysisResult ?? directAnalysisResult;
  const dosageResult = baseRecord?.dosageResult ?? payloadDosageResult ?? analysisResult?.dosage;

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
    analysisResult,
    dosageResult,
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
    dosageResult: normalizedRecord.dosageResult,
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
    is_billable: normalizedRecord.analysisResult?.isValidStrip !== false,
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

function describeSupabaseError(error: unknown) {
  if (!error || typeof error !== 'object') return error;
  const typed = error as { code?: string; details?: string; hint?: string; message?: string };
  return {
    code: typed.code,
    details: typed.details,
    hint: typed.hint,
    message: typed.message,
  };
}

export async function fetchCloudTests(accountId: string, pools: Pool[], userId?: string): Promise<SavedHistoryRecord[]> {
  if (!isSupabaseConfigured) return [];

  const fullQuery = getSupabaseClient()
    .from('tests')
    .select(FULL_TEST_SELECT)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(TEST_HISTORY_LIMIT);

  const { data, error } = await fullQuery;

  if (!error) {
    return (data ?? []).map((row) => mapCloudTestToLocal(row as TestRow, pools));
  }

  console.warn('Failed to fetch full cloud tests; retrying summary query', {
    accountId,
    userId,
    error: describeSupabaseError(error),
  });

  const { data: summaryData, error: summaryError } = await getSupabaseClient()
    .from('tests')
    .select(SUMMARY_TEST_SELECT)
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(TEST_HISTORY_LIMIT);

  if (summaryError) throw summaryError;
  return (summaryData ?? []).map((row) => mapCloudTestToLocal({ raw_result: {}, ...row } as TestRow, pools));
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

function isFreshLocalRecord(record: SavedHistoryRecord) {
  const createdAt = record.createdAt ?? record.testedAt ?? 0;
  return Date.now() - createdAt < 10 * 60 * 1000;
}

export interface TestSyncResult {
  records: SavedHistoryRecord[];
  pushedCount: number;
  pulledCount: number;
}

// Simple conflict strategy:
// Supabase is authoritative after login. Local-only tests from AsyncStorage are
// not uploaded during automatic login sync, because that can resurrect history
// the user deleted from the cloud. Fresh Results saves still call
// upsertTestToCloud directly and are uploaded immediately.
export async function syncTestsWithCloud(
  localRecords: SavedHistoryRecord[],
  user: User,
  accountId: string,
  pools: Pool[],
): Promise<TestSyncResult> {
  if (!isSupabaseConfigured) {
    return { records: localRecords, pushedCount: 0, pulledCount: 0 };
  }

  const remoteRecords = await fetchCloudTests(accountId, pools, user.id);
  const remoteByCloudId = new Map(remoteRecords.map((record) => [record.cloudId ?? record.testId, record]));
  const merged: SavedHistoryRecord[] = [];
  let pushedCount = 0;
  let pulledCount = 0;

  for (const localRecord of localRecords) {
    const cloudId = testSyncKey(localRecord);
    const remoteRecord = cloudId ? remoteByCloudId.get(cloudId) : undefined;

    if (!remoteRecord) {
      if (isFreshLocalRecord(localRecord)) {
        merged.push(localRecord);
      }
      // Local-only or deleted cloud tests should not be recreated on login.
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
