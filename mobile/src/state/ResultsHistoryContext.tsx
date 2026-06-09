import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { StatusTone } from '../components/StatusBadge';
import { mockPools, resultRows } from '../data/mockAppData';

export interface SavedHistoryRecord {
  id: string;
  date: string;
  poolName: string;
  resultSummary: string;
  status: string;
  tone: StatusTone;
  createdAt: number;
}

interface SaveMockResultInput {
  poolId?: string;
}

interface ResultsHistoryContextValue {
  historyRecords: SavedHistoryRecord[];
  saveMockResult: (input?: SaveMockResultInput) => SavedHistoryRecord;
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

function buildResultSummary() {
  const importantValues = resultRows
    .filter((row) => row.label === 'pH' || row.label === 'כלור' || row.label === 'אלקליניות')
    .map((row) => `${row.label} ${row.value}`);

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
      saveMockResult(input) {
        const pool = input?.poolId ? mockPools.find((item) => item.id === input.poolId) : undefined;
        const hasWarning = resultRows.some((row) => row.tone === 'warning');
        const createdAt = Date.now();
        const record: SavedHistoryRecord = {
          id: `history-${createdAt}`,
          date: formatDateTime(createdAt),
          poolName: pool?.name ?? mockPools[0].name,
          resultSummary: buildResultSummary(),
          status: hasWarning ? 'נדרש תיקון קל' : 'המים מאוזנים',
          tone: hasWarning ? 'warning' : 'success',
          createdAt,
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
