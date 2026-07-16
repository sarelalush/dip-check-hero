import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { StatusTone } from '../components/StatusBadge';
import { getBrand } from '../config/stripBrands';
import type { DosageCalculationResult } from '../domain/dosage';
import type { StripAnalysisResult } from '../domain/scanResults';
import { usePools } from './PoolsContext';
import { useAuth } from './AuthContext';
import { getTestCloudId, syncTestsWithCloud, upsertTestToCloud } from '../services/testCloudSync';
import { getPublicScanImageUrl } from '../services/scanImageStorage';

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
  syncing: boolean;
  syncError?: string;
  getHistoryRecord: (testId: string) => SavedHistoryRecord | undefined;
  getPoolHistoryRecords: (poolId: string, limit?: number) => SavedHistoryRecord[];
  refreshHistory: () => Promise<void>;
  saveAnalysisResult: (analysisResult: StripAnalysisResult) => SavedHistoryRecord;
}

const ResultsHistoryContext = createContext<ResultsHistoryContextValue | null>(null);
const HISTORY_STORAGE_KEY = '@aquasense/history-records';
const HISTORY_STORAGE_LIMIT = 15;
const FALLBACK_POOL_NAME = 'הבריכה שלי';

function getHistoryStorageKey(ownerKey: string) {
  return `${HISTORY_STORAGE_KEY}:${ownerKey}`;
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
    dosageResult: record.dosageResult ?? record.analysisResult?.dosage,
  };
}

function recordKey(record: SavedHistoryRecord) {
  return record.cloudId ?? record.testId ?? record.id;
}

function recordUpdatedAt(record: SavedHistoryRecord) {
  return record.updatedAt ?? record.testedAt ?? record.createdAt ?? 0;
}

function dedupeHistoryRecords(records: SavedHistoryRecord[]) {
  const unique = new Map<string, SavedHistoryRecord>();

  for (const record of records.map(normalizeHistoryRecord)) {
    const key = recordKey(record);
    const existing = unique.get(key);

    if (!existing || recordUpdatedAt(record) >= recordUpdatedAt(existing)) {
      unique.set(key, record);
    }
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
  const { getPool, pools } = usePools();
  const [historyRecords, setHistoryRecords] = useState<SavedHistoryRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [hydratedOwnerKey, setHydratedOwnerKey] = useState<string | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();
  const historyRecordsRef = useRef<SavedHistoryRecord[]>([]);
  const syncInFlightRef = useRef(false);
  const syncRunIdRef = useRef(0);
  const ownerKey = authLoading ? undefined : user && accountId ? `${user.id}:${accountId}` : 'anonymous';

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
      setSyncing(false);
      setSyncError(undefined);
      return undefined;
    }

    let isMounted = true;
    const storageKey = getHistoryStorageKey(ownerKey);

    async function restoreHistoryRecords() {
      setHistoryRecords([]);
      setHydrated(false);
      setHydratedOwnerKey(undefined);
      setSyncError(undefined);

      try {
        const storedRecords = await AsyncStorage.getItem(storageKey);
        if (!isMounted) return;
        if (storedRecords) {
          const parsedRecords = JSON.parse(storedRecords) as SavedHistoryRecord[];
          if (Array.isArray(parsedRecords)) {
            setHistoryRecords(dedupeHistoryRecords(parsedRecords));
          }
        }
      } catch (error) {
        console.warn('Failed to restore history records from storage', error);
      } finally {
        if (isMounted) {
          setHydratedOwnerKey(ownerKey);
          setHydrated(true);
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
      if (!hydrated || !ownerKey || hydratedOwnerKey !== ownerKey || authLoading || !user || !accountId || syncInFlightRef.current) return;

      const syncRunId = syncRunIdRef.current + 1;
      syncRunIdRef.current = syncRunId;
      syncInFlightRef.current = true;
      setSyncing(true);
      setSyncError(undefined);

      try {
        const result = await syncTestsWithCloud(localRecords, user, accountId, pools);
        if (syncRunIdRef.current === syncRunId) {
          setHistoryRecords(dedupeHistoryRecords(result.records));
        }
      } catch (error) {
        if (syncRunIdRef.current !== syncRunId) return;
        console.warn('Failed to sync history with cloud', error);
        setSyncError('סנכרון היסטוריית הבדיקות לענן נכשל. הנתונים המקומיים נשמרו.');
      } finally {
        if (syncRunIdRef.current === syncRunId) {
          syncInFlightRef.current = false;
          setSyncing(false);
        }
      }
    },
    [accountId, authLoading, hydrated, hydratedOwnerKey, ownerKey, pools, user],
  );

  useEffect(() => {
    syncAuthenticatedHistory(historyRecords);
  }, [accountId, authLoading, hydrated, pools, syncAuthenticatedHistory, user?.id]);

  const refreshHistory = useCallback(async () => {
    await syncAuthenticatedHistory(historyRecordsRef.current);
  }, [syncAuthenticatedHistory]);

  async function syncRecordToCloud(record: SavedHistoryRecord) {
    if (!user || !accountId) return;

    try {
      const syncedRecord = await upsertTestToCloud(record, user.id, accountId, pools);
      if (!syncedRecord) return;

      setHistoryRecords((current) =>
        dedupeHistoryRecords(current.map((item) =>
          item.testId === syncedRecord.testId || item.id === syncedRecord.id || item.cloudId === syncedRecord.cloudId
            ? normalizeHistoryRecord({ ...item, ...syncedRecord })
            : item,
        )),
      );
      setSyncError(undefined);
    } catch (error) {
      console.warn('Failed to sync history record with cloud', error);
      setSyncError('שמירת הבדיקה לענן נכשלה. היא נשמרה מקומית.');
    }
  }

  const value = useMemo<ResultsHistoryContextValue>(
    () => ({
      historyRecords,
      isHydrated: hydrated,
      syncing,
      syncError,
      getHistoryRecord(testId) {
        return historyRecords.find((record) => record.testId === testId || record.id === testId || record.cloudId === testId);
      },
      getPoolHistoryRecords(poolId, limit = 3) {
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
        const existingRecord = historyRecords.find((record) => record.testId === testId || record.id === testId || record.cloudId === testId);
        if (existingRecord) return existingRecord;

        const brand = analysisResult.brandId ? getBrand(analysisResult.brandId) : undefined;
        const record: SavedHistoryRecord = {
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

        setHistoryRecords((current) => {
          if (current.some((item) => item.testId === record.testId || item.id === record.id || item.cloudId === record.cloudId)) {
            return current;
          }
          return dedupeHistoryRecords([record, ...current]);
        });
        syncRecordToCloud(record);
        return record;
      },
    }),
    [accountId, getPool, historyRecords, hydrated, pools, refreshHistory, syncError, syncing, user],
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
