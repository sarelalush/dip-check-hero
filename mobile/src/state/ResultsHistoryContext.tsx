import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StatusTone } from '../components/StatusBadge';
import { mockPools } from '../data/mockAppData';
import type { StripAnalysisResult } from '../domain/scanResults';

export interface SavedHistoryRecord {
  id: string;
  date: string;
  poolName: string;
  resultSummary: string;
  status: string;
  tone: StatusTone;
  createdAt: number;
  analysisResult?: StripAnalysisResult;
}

interface ResultsHistoryContextValue {
  historyRecords: SavedHistoryRecord[];
  saveAnalysisResult: (analysisResult: StripAnalysisResult) => SavedHistoryRecord;
}

const ResultsHistoryContext = createContext<ResultsHistoryContextValue | null>(null);
const HISTORY_STORAGE_KEY = '@aquasense/history-records';

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
  const importantValues = analysisResult.parameters
    .filter((parameter) => parameter.key === 'ph' || parameter.key === 'chlorine' || parameter.key === 'alkalinity')
    .map((parameter) => `${parameter.name} ${formatParameterValue(parameter.value, parameter.unit)}`);

  return importantValues.join(' · ');
}

export function ResultsHistoryProvider({ children }: { children: ReactNode }) {
  const [historyRecords, setHistoryRecords] = useState<SavedHistoryRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function restoreHistoryRecords() {
      try {
        const storedRecords = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
        if (!isMounted) return;
        if (storedRecords) {
          const parsedRecords = JSON.parse(storedRecords) as SavedHistoryRecord[];
          if (Array.isArray(parsedRecords)) {
            setHistoryRecords(parsedRecords);
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

  const value = useMemo<ResultsHistoryContextValue>(
    () => ({
      historyRecords,
      saveAnalysisResult(analysisResult) {
        const pool = analysisResult.poolId ? mockPools.find((item) => item.id === analysisResult.poolId) : undefined;
        const createdAt = Date.now();
        const record: SavedHistoryRecord = {
          id: `history-${createdAt}`,
          date: formatDateTime(createdAt),
          poolName: pool?.name ?? mockPools[0].name,
          resultSummary: buildResultSummary(analysisResult),
          status: analysisResult.overallStatus.label,
          tone: analysisResult.overallStatus.tone,
          createdAt,
          analysisResult,
        };

        setHistoryRecords((current) => [record, ...current]);
        return record;
      },
    }),
    [historyRecords],
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
