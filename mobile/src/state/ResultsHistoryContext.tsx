import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StatusTone } from '../components/StatusBadge';
import { getBrand } from '../config/stripBrands';
import type { DosageCalculationResult } from '../domain/dosage';
import { protectAnalysisResult, MEASUREMENT_ACTION } from '../domain/dosage';
import { resultStatus } from '../domain/resultPresentation';
import type { StripAnalysisResult } from '../domain/scanResults';
import { usePools } from './PoolsContext';
import { useAuth } from './AuthContext';
import { getTestCloudId, syncTestsWithCloud, upsertTestToCloud } from '../services/testCloudSync';
import { getPublicScanImageUrl } from '../services/scanImageStorage';
import { getSavedTreatmentPlan, treatmentPlanContentKey } from '../domain/savedTreatmentPlan';

export interface SavedHistoryRecord {
  id: string;
  testId: string;
  cloudId?: string;
  accountId?: string;
  date: string;
  poolId?: string;
  poolName: string;
  brandId?: string;
  brandName?: string;
  imageUri?: string;
  imagePath?: string;
  imageUrl?: string;
  imageUploadError?: string;
  resultSummary: string;
  status: string;
  tone: StatusTone;
  testedAt: number;
  createdAt: number;
  updatedAt?: number;
  analysisResult?: StripAnalysisResult;
  dosageResult?: DosageCalculationResult;
}

interface ResultsHistoryContextValue {
  historyRecords: SavedHistoryRecord[];
  isHydrated: boolean;
  initialSyncComplete: boolean;
  syncing: boolean;
  syncError?: string;
  getHistoryRecord: (testId: string) => SavedHistoryRecord | undefined;
  getPoolHistoryRecords: (poolId: string, limit?: number) => SavedHistoryRecord[];
  refreshHistory: () => Promise<void>;
  saveAnalysisResult: (analysisResult: StripAnalysisResult) => SavedHistoryRecord;
}

const ResultsHistoryContext = createContext<ResultsHistoryContextValue | null>(null);
const HISTORY_STORAGE_KEY = '@aquasense/history-records';
const HISTORY_CACHE_READY_KEY = '@aquasense/history-cache-ready';
const HISTORY_CACHE_READY_VERSION = 'v2';
const HISTORY_STORAGE_LIMIT = 15;
const FALLBACK_POOL_NAME = 'הבריכה שלי';

function getHistoryStorageKey(ownerKey: string) {
  return `${HISTORY_STORAGE_KEY}:${ownerKey}`;
}

function getHistoryCacheReadyKey(ownerKey: string) {
  return `${HISTORY_CACHE_READY_KEY}:${ownerKey}`;
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  }).format(new Date(timestamp));
}

function formatParameterValue(value: number, unit: string) {
  return unit ? `${value} ${unit}` : `${value}`;
}

function buildResultSummary(analysisResult: StripAnalysisResult) {
  if (analysisResult.dosage?.summary) {
    return analysisResult.dosage.summary.split('\n')[0];
  }

  const importantValues = analysisResult.parameters
    .filter((parameter) => parameter.key === 'ph' || parameter.key === 'freeChlorine' || parameter.key === 'alkalinity')
    .map((parameter) => `${parameter.name} ${formatParameterValue(parameter.value, parameter.unit)}`);

  return importantValues.join(' · ');
}

function createTestId(analysisResult: StripAnalysisResult, timestamp: number) {
  if (analysisResult.id && !analysisResult.id.startsWith('analysis-')) {
    return analysisResult.id;
  }

  return `test-${timestamp}-${Math.floor(Math.random() * 10000)}`;
}

function normalizeHistoryRecord(record: SavedHistoryRecord): SavedHistoryRecord {
  const testedAt = record.testedAt ?? record.analysisResult?.analyzedAt ?? record.createdAt ?? Date.now();
  const testId = record.testId ?? record.id ?? `test-${testedAt}`;
  const brandId = record.brandId ?? record.analysisResult?.brandId;
  const brand = record.brandName || !brandId ? undefined : getBrand(brandId);
  const analysisResult = record.analysisResult ? protectAnalysisResult(record.analysisResult) : undefined;
  const safeStatus = analysisResult ? resultStatus(analysisResult) : undefined;

  return {
    ...record,
    id: record.id ?? testId,
    testId,
    testedAt,
    createdAt: record.createdAt ?? testedAt,
    updatedAt: record.updatedAt ?? record.createdAt ?? testedAt,
    brandId,
    brandName: record.brandName ?? brand?.nameHe,
    imageUri: record.imageUri ?? record.analysisResult?.imageUri,
    imagePath: record.imagePath ?? record.analysisResult?.imagePath,
    imageUrl: record.imageUrl ?? record.analysisResult?.imageUrl ?? getPublicScanImageUrl(record.imagePath ?? record.analysisResult?.imagePath),
    imageUploadError: record.imageUploadError,
    resultSummary: MEASUREMENT_ACTION,
    analysisResult,
    status: safeStatus?.label ?? 'בדיקה שמורה; יש לאמת לפני טיפול',
    tone: safeStatus?.tone ?? 'neutral',
    dosageResult: analysisResult?.dosage,
  };
}

function recordKey(record: SavedHistoryRecord) {
  return record.cloudId ?? record.testId ?? record.id;
}

function recordUpdatedAt(record: SavedHistoryRecord) {
  return record.updatedAt ?? record.testedAt ?? record.createdAt ?? 0;
}

function mergeHistoryRecord(first: SavedHistoryRecord, second: SavedHistoryRecord): SavedHistoryRecord {
  const preferred = recordUpdatedAt(second) >= recordUpdatedAt(first) ? second : first;
  const firstPlan = getSavedTreatmentPlan(first.analysisResult);
  const secondPlan = getSavedTreatmentPlan(second.analysisResult);
  const plan = !firstPlan ? secondPlan : !secondPlan ? firstPlan :
    firstPlan.product && !secondPlan.product ? firstPlan :
    secondPlan.product && !firstPlan.product ? secondPlan :
    firstPlan.proposedAt === secondPlan.proposedAt
      ? getSavedTreatmentPlan(preferred.analysisResult) ?? firstPlan
      : secondPlan.proposedAt > firstPlan.proposedAt ? secondPlan : firstPlan;
  const analysis = preferred.analysisResult;
  return {
    ...preferred,
    imagePath: preferred.imagePath ?? first.imagePath ?? second.imagePath,
    imageUrl: preferred.imageUrl ?? first.imageUrl ?? second.imageUrl,
    analysisResult: plan && analysis?.id === plan.resultId && analysis.analyzedAt === plan.analyzedAt
      ? { ...analysis, treatmentPlan: plan } : analysis,
  };
}

function dedupeHistoryRecords(records: SavedHistoryRecord[]) {
  const unique = new Map<string, SavedHistoryRecord>();

  for (const record of records.map(normalizeHistoryRecord)) {
    const key = recordKey(record);
    const existing = unique.get(key);

    unique.set(key, existing ? mergeHistoryRecord(existing, record) : record);
  }

  return Array.from(unique.values())
    .sort((a, b) => b.testedAt - a.testedAt)
    .slice(0, HISTORY_STORAGE_LIMIT);
}

function compactHistoryRecordForStorage(record: SavedHistoryRecord): SavedHistoryRecord {
  const normalized = normalizeHistoryRecord(record);
  const isHeavyTransientUri = normalized.imageUri?.startsWith('data:') || normalized.imageUri?.startsWith('blob:');

  return {
    ...normalized,
    imageUri: isHeavyTransientUri ? undefined : normalized.imageUri,
  };
}

function poolIdsFor(poolId: string, pools: ReturnType<typeof usePools>['pools']) {
  const pool = pools.find((item) => item.id === poolId || item.cloudId === poolId);
  return new Set([poolId, pool?.id, pool?.cloudId].filter((id): id is string => Boolean(id)));
}

function isRecordForPool(record: SavedHistoryRecord, poolIds: Set<string>) {
  return Boolean(record.poolId && poolIds.has(record.poolId));
}

export function ResultsHistoryProvider({ children }: { children: ReactNode }) {
  const { accountId, user, loading: authLoading } = useAuth();
  const { getPool, initialSyncComplete: poolsInitialSyncComplete, pools } = usePools();
  const [historyRecords, setHistoryRecords] = useState<SavedHistoryRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydratedOwnerKey, setHydratedOwnerKey] = useState<string | undefined>();
  const [initialSyncComplete, setInitialSyncComplete] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();
  const historyRecordsRef = useRef<SavedHistoryRecord[]>([]);
  const syncInFlightRef = useRef(false);
  const syncRunIdRef = useRef(0);
  const recordSyncQueue = useRef(new Map<string, Promise<void>>());
  const ownerKey = authLoading ? undefined : user && accountId ? `${user.id}:${accountId}` : 'anonymous';
  const activeOwnerRef = useRef(ownerKey);
  activeOwnerRef.current = ownerKey;
  const isReadyForOwner = Boolean(ownerKey && hydratedOwnerKey === ownerKey && hydrated);

  useEffect(() => {
    historyRecordsRef.current = historyRecords;
  }, [historyRecords]);

  useEffect(() => {
    syncRunIdRef.current += 1;
    syncInFlightRef.current = false;

    if (!ownerKey) {
      setHistoryRecords([]);
      setHydrated(false);
      setHydratedOwnerKey(undefined);
      setInitialSyncComplete(false);
      setSyncing(false);
      setSyncError(undefined);
      return undefined;
    }

    let isMounted = true;
    const storageKey = getHistoryStorageKey(ownerKey);
    const cacheReadyKey = getHistoryCacheReadyKey(ownerKey);

    async function restoreHistoryRecords() {
      setHistoryRecords([]);
      setHydrated(false);
      setHydratedOwnerKey(undefined);
      setInitialSyncComplete(false);
      setSyncError(undefined);

      try {
        const [storedRecords, cacheReady] = await Promise.all([
          AsyncStorage.getItem(storageKey),
          AsyncStorage.getItem(cacheReadyKey),
        ]);
        if (!isMounted) return;
        let hasUsableCache = cacheReady === HISTORY_CACHE_READY_VERSION;

        if (storedRecords) {
          const parsedRecords = JSON.parse(storedRecords) as SavedHistoryRecord[];
          if (Array.isArray(parsedRecords)) {
            const restoredRecords = dedupeHistoryRecords(parsedRecords);
            setHistoryRecords(restoredRecords);
            hasUsableCache = hasUsableCache || restoredRecords.length > 0;
          }
        }

        if (hasUsableCache) {
          setInitialSyncComplete(true);
        }
      } catch (error) {
        console.warn('Failed to restore history records from storage', error);
      } finally {
        if (isMounted) {
          setHydratedOwnerKey(ownerKey);
          setHydrated(true);
          setInitialSyncComplete((current) => current || ownerKey === 'anonymous');
        }
      }
    }

    restoreHistoryRecords();

    return () => {
      isMounted = false;
    };
  }, [ownerKey]);

  useEffect(() => {
    if (!hydrated || !hydratedOwnerKey) return;
    const storageKey = getHistoryStorageKey(hydratedOwnerKey);

    async function persistHistoryRecords() {
      try {
        const compactRecords = dedupeHistoryRecords(historyRecords).map(compactHistoryRecordForStorage);
        await AsyncStorage.setItem(storageKey, JSON.stringify(compactRecords));
      } catch (error) {
        console.warn('Failed to persist history records to storage', error);
      }
    }

    persistHistoryRecords();
  }, [hydrated, hydratedOwnerKey, historyRecords]);

  const syncAuthenticatedHistory = useCallback(
    async (localRecords: SavedHistoryRecord[]) => {
      if (
        !hydrated
        || !ownerKey
        || hydratedOwnerKey !== ownerKey
        || authLoading
        || !user
        || !accountId
        || !poolsInitialSyncComplete
        || syncInFlightRef.current
      ) return;

      const syncRunId = syncRunIdRef.current + 1;
      const syncStartedAt = Date.now();
      syncRunIdRef.current = syncRunId;
      syncInFlightRef.current = true;
      setSyncing(true);
      setSyncError(undefined);

      try {
        const result = await syncTestsWithCloud(localRecords, user, accountId, pools);
        if (syncRunIdRef.current === syncRunId) {
          const remoteKeys = new Set(result.records.map(recordKey));
          // Keep instructions saved while a full sync was already in flight.
          // Absent older records remain absent, preserving cloud deletions.
          const changedRecords = historyRecordsRef.current.filter(record =>
            remoteKeys.has(recordKey(record)) || recordUpdatedAt(record) >= syncStartedAt);
          const merged = dedupeHistoryRecords([...result.records, ...changedRecords]);
          historyRecordsRef.current = merged;
          setHistoryRecords(merged);
          for (const record of merged) {
            const plan = getSavedTreatmentPlan(record.analysisResult);
            const synced = result.records.find(item => recordKey(item) === recordKey(record));
            const syncedPlan = getSavedTreatmentPlan(synced?.analysisResult);
            if (plan && (!syncedPlan || treatmentPlanContentKey(plan) !== treatmentPlanContentKey(syncedPlan)))
              syncRecordToCloud(record);
          }
          await AsyncStorage.setItem(getHistoryCacheReadyKey(ownerKey), HISTORY_CACHE_READY_VERSION);
        }
      } catch (error) {
        if (syncRunIdRef.current !== syncRunId) return;
        console.warn('Failed to sync history with cloud', error);
        setSyncError('סנכרון היסטוריית הבדיקות לענן נכשל. הנתונים המקומיים נשמרו.');
      } finally {
        if (syncRunIdRef.current === syncRunId) {
          syncInFlightRef.current = false;
          setSyncing(false);
          setInitialSyncComplete(true);
        }
      }
    },
    [accountId, authLoading, hydrated, hydratedOwnerKey, ownerKey, pools, poolsInitialSyncComplete, user],
  );

  useEffect(() => {
    syncAuthenticatedHistory(historyRecords);
  }, [accountId, authLoading, hydrated, pools, poolsInitialSyncComplete, syncAuthenticatedHistory, user?.id]);

  const refreshHistory = useCallback(async () => {
    await syncAuthenticatedHistory(historyRecordsRef.current);
  }, [syncAuthenticatedHistory]);

  async function persistRecordToCloud(record: SavedHistoryRecord) {
    if (!user || !accountId || activeOwnerRef.current !== ownerKey) return;

    try {
      const latest = historyRecordsRef.current.find(item => recordKey(item) === recordKey(record));
      const outgoing = latest ? mergeHistoryRecord(record, latest) : record;
      const syncedRecord = await upsertTestToCloud(outgoing, user.id, accountId, pools);
      if (!syncedRecord || activeOwnerRef.current !== ownerKey) return;

      const mergeSynced = (current: SavedHistoryRecord[]) => dedupeHistoryRecords(current.map((item) =>
          item.testId === syncedRecord.testId || item.id === syncedRecord.id || item.cloudId === syncedRecord.cloudId
            ? normalizeHistoryRecord(mergeHistoryRecord(item, syncedRecord))
            : item,
        ));
      historyRecordsRef.current = mergeSynced(historyRecordsRef.current);
      setHistoryRecords(mergeSynced);
      setSyncError(undefined);
    } catch (error) {
      if (activeOwnerRef.current !== ownerKey) return;
      console.warn('Failed to sync history record with cloud', error);
      setSyncError('שמירת הבדיקה לענן נכשלה. היא נשמרה מקומית.');
    }
  }

  function syncRecordToCloud(record: SavedHistoryRecord) {
    // The initial autosave must finish before a later instruction snapshot for
    // the same test, so a late response cannot erase its amount in the cloud.
    const key = `${ownerKey ?? ''}:${record.testId}`;
    const previous = recordSyncQueue.current.get(key) ?? Promise.resolve();
    const pending = previous.catch(() => {}).then(() => persistRecordToCloud(record));
    recordSyncQueue.current.set(key, pending);
    void pending.finally(() => {
      if (recordSyncQueue.current.get(key) === pending) recordSyncQueue.current.delete(key);
    });
  }

  const value = useMemo<ResultsHistoryContextValue>(
    () => ({
      historyRecords: isReadyForOwner ? historyRecords : [],
      isHydrated: isReadyForOwner,
      initialSyncComplete: isReadyForOwner && initialSyncComplete,
      syncing,
      syncError,
      getHistoryRecord(testId) {
        return isReadyForOwner ? historyRecords.find((record) => record.testId === testId || record.id === testId || record.cloudId === testId) : undefined;
      },
      getPoolHistoryRecords(poolId, limit = 3) {
        if (!isReadyForOwner) return [];
        const ids = poolIdsFor(poolId, pools);
        return historyRecords
          .filter((record) => isRecordForPool(record, ids))
          .sort((a, b) => b.testedAt - a.testedAt)
          .slice(0, limit);
      },
      refreshHistory,
      saveAnalysisResult(analysisResult) {
        const pool = analysisResult.poolId ? getPool(analysisResult.poolId) : undefined;
        const createdAt = Date.now();
        const testedAt = analysisResult.analyzedAt ?? createdAt;
        const testId = createTestId(analysisResult, createdAt);
        const existingRecord = historyRecordsRef.current.find((record) => record.testId === testId || record.id === testId || record.cloudId === testId);
        const incomingPlan = getSavedTreatmentPlan(analysisResult);
        const existingPlan = getSavedTreatmentPlan(existingRecord?.analysisResult);
        // A manual DPD proposal must not replace an archive that arrived while
        // its form was open (including an in-flight initial cloud sync).
        if (existingRecord && incomingPlan?.shock && existingPlan &&
            treatmentPlanContentKey(existingPlan) !== treatmentPlanContentKey(incomingPlan)) return existingRecord;
        if (existingRecord && (!incomingPlan || (existingPlan &&
          treatmentPlanContentKey(existingPlan) === treatmentPlanContentKey(incomingPlan)))) return existingRecord;

        const brand = analysisResult.brandId ? getBrand(analysisResult.brandId) : undefined;
        const record: SavedHistoryRecord = existingRecord ? {
          ...existingRecord,
          updatedAt: Math.max(createdAt, recordUpdatedAt(existingRecord) + 1),
          analysisResult: { ...(existingRecord.analysisResult ?? analysisResult), treatmentPlan: incomingPlan },
        } : {
          id: testId,
          testId,
          accountId,
          date: formatDateTime(testedAt),
          poolId: analysisResult.poolId,
          poolName: pool?.name ?? FALLBACK_POOL_NAME,
          brandId: analysisResult.brandId,
          brandName: brand?.nameHe,
          imageUri: analysisResult.imageUri,
          imagePath: analysisResult.imagePath,
          imageUrl: analysisResult.imageUrl,
          resultSummary: buildResultSummary(analysisResult),
          status: analysisResult.overallStatus.label,
          tone: analysisResult.overallStatus.tone,
          testedAt,
          createdAt,
          updatedAt: createdAt,
          analysisResult,
          dosageResult: analysisResult.dosage,
        };
        record.cloudId = getTestCloudId(record);

        // Update the ref immediately: parent autosave and child snapshot effects
        // can run in the same render, before React publishes the next state.
        historyRecordsRef.current = dedupeHistoryRecords([record, ...historyRecordsRef.current]);
        setHistoryRecords(current => dedupeHistoryRecords([record, ...current]));
        syncRecordToCloud(record);
        return record;
      },
    }),
    [accountId, getPool, historyRecords, hydrated, initialSyncComplete, isReadyForOwner, pools, refreshHistory, syncError, syncing, user],
  );

  return <ResultsHistoryContext.Provider value={value}>{children}</ResultsHistoryContext.Provider>;
}

export function useResultsHistory() {
  const context = useContext(ResultsHistoryContext);
  if (!context) {
    throw new Error('useResultsHistory must be used inside ResultsHistoryProvider');
  }
  return context;
}
