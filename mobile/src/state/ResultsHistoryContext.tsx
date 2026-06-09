import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StatusTone } from '../components/StatusBadge';
import { getBrand } from '../config/stripBrands';
import type { DosageCalculationResult } from '../domain/dosage';
import type { StripAnalysisResult } from '../domain/scanResults';
import { usePools } from './PoolsContext';
import { useAuth } from './AuthContext';
import { syncTestsWithCloud, upsertTestToCloud } from '../services/testCloudSync';

export interface SavedHistoryRecord {
  id: string;
  testId: string;
  cloudId?: string;
  date: string;
  poolId?: string;
  poolName: string;
  brandId?: string;
  brandName?: string;
  imageUri?: string;
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
  saveAnalysisResult: (analysisResult: StripAnalysisResult) => SavedHistoryRecord;
}

const ResultsHistoryContext = createContext<ResultsHistoryContextValue | null>(null);
const HISTORY_STORAGE_KEY = '@aquasense/history-records';
const FALLBACK_POOL_NAME = 'הבריכה שלי';

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
    dosageResult: record.dosageResult ?? record.analysisResult?.dosage,
  };
}

export function ResultsHistoryProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { getPool, pools } = usePools();
  const [historyRecords, setHistoryRecords] = useState<SavedHistoryRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    async function restoreHistoryRecords() {
      try {
        const storedRecords = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!isMounted) return;
        if (storedRecords) {
          const parsedRecords = JSON.parse(storedRecords) as SavedHistoryRecord[];
          if (Array.isArray(parsedRecords)) {
            setHistoryRecords(parsedRecords.map(normalizeHistoryRecord));
          }
        }
      } catch (error) {
        console.warn('Failed to restore history records from storage', error);
      } finally {
        if (isMounted) {
          setHydrated(true);
        }
      }
    }

    restoreHistoryRecords();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    async function persistHistoryRecords() {
      try {
        await AsyncStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyRecords));
      } catch (error) {
        console.warn('Failed to persist history records to storage', error);
      }
    }

    persistHistoryRecords();
  }, [hydrated, historyRecords]);

  useEffect(() => {
    if (!hydrated || authLoading || !user) return;

    let isMounted = true;
    const currentUser = user;
    const currentPools = pools;

    async function syncAuthenticatedHistory() {
      setSyncing(true);
      setSyncError(undefined);

      try {
        const result = await syncTestsWithCloud(historyRecords, currentUser, currentPools);
        if (!isMounted) return;
        setHistoryRecords(result.records.map(normalizeHistoryRecord));
      } catch (error) {
        if (!isMounted) return;
        console.warn('Failed to sync history with cloud', error);
        setSyncError('סנכרון היסטוריית הבדיקות לענן נכשל. הנתונים המקומיים נשמרו.');
      } finally {
        if (isMounted) {
          setSyncing(false);
        }
      }
    }

    syncAuthenticatedHistory();

    return () => {
      isMounted = false;
    };
  }, [authLoading, hydrated, user?.id, pools]);

  async function syncRecordToCloud(record: SavedHistoryRecord) {
    if (!user) return;

    try {
      const syncedRecord = await upsertTestToCloud(record, user.id, pools);
      if (!syncedRecord) return;

      setHistoryRecords((current) =>
        current.map((item) =>
          item.testId === syncedRecord.testId || item.id === syncedRecord.id
            ? normalizeHistoryRecord({ ...item, cloudId: syncedRecord.cloudId, updatedAt: syncedRecord.updatedAt })
            : item,
        ),
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
        return historyRecords.find((record) => record.testId === testId || record.id === testId);
      },
      getPoolHistoryRecords(poolId, limit = 3) {
        return historyRecords
          .filter((record) => record.poolId === poolId)
          .sort((a, b) => b.testedAt - a.testedAt)
          .slice(0, limit);
      },
      saveAnalysisResult(analysisResult) {
        const pool = analysisResult.poolId ? getPool(analysisResult.poolId) : undefined;
        const createdAt = Date.now();
        const testedAt = analysisResult.analyzedAt ?? createdAt;
        const testId = createTestId(analysisResult, createdAt);
        const brand = analysisResult.brandId ? getBrand(analysisResult.brandId) : undefined;
        const record: SavedHistoryRecord = {
          id: testId,
          testId,
          date: formatDateTime(testedAt),
          poolId: analysisResult.poolId,
          poolName: pool?.name ?? FALLBACK_POOL_NAME,
          brandId: analysisResult.brandId,
          brandName: brand?.nameHe,
          imageUri: analysisResult.imageUri,
          resultSummary: buildResultSummary(analysisResult),
          status: analysisResult.overallStatus.label,
          tone: analysisResult.overallStatus.tone,
          testedAt,
          createdAt,
          updatedAt: createdAt,
          analysisResult,
          dosageResult: analysisResult.dosage,
        };

        setHistoryRecords((current) => [record, ...current]);
        syncRecordToCloud(record);
        return record;
      },
    }),
    [getPool, historyRecords, hydrated, pools, syncError, syncing, user],
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
