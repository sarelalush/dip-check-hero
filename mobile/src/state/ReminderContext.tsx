import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  cancelPoolReminderNotification,
  schedulePoolReminderNotification,
  type ReminderNotificationFrequency,
} from '../services/notificationService';

export type ReminderFrequency = ReminderNotificationFrequency;

interface ReminderEntry {
  error?: string;
  frequency: ReminderFrequency;
  notificationId?: string;
  updatedAt: number;
}

export interface ReminderInfo {
  error?: string;
  frequency: ReminderFrequency;
  updatedAt?: number;
}

interface ReminderContextValue {
  hydrated: boolean;
  getReminder: (poolId: string) => ReminderFrequency;
  getReminderError: (poolId: string) => string | undefined;
  getReminderInfo: (poolId: string) => ReminderInfo;
  setReminder: (poolId: string, frequency: ReminderFrequency, poolName?: string) => Promise<void>;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);
const REMINDER_STORAGE_KEY = '@aquasense/pool-reminders';

function normalizeFrequency(value: unknown): ReminderFrequency {
  if (value === 'every3h' || value === 'every6h' || value === 'every12h' || value === 'daily' || value === 'off') {
    return value;
  }

  if (value === 'weekly' || value === 'biweekly' || value === 'monthly') {
    return 'daily';
  }

  return 'off';
}

function normalizeStoredReminders(stored: string) {
  const parsed = JSON.parse(stored) as Record<string, ReminderFrequency | Partial<ReminderEntry>>;
  const normalized: Record<string, ReminderEntry> = {};

  for (const [poolId, value] of Object.entries(parsed)) {
    if (typeof value === 'string') {
      normalized[poolId] = {
        frequency: normalizeFrequency(value),
        updatedAt: Date.now(),
      };
      continue;
    }

    if (value && typeof value === 'object' && value.frequency) {
      normalized[poolId] = {
        error: value.error,
        frequency: normalizeFrequency(value.frequency),
        notificationId: value.notificationId,
        updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : Date.now(),
      };
    }
  }

  return normalized;
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Record<string, ReminderEntry>>({});

  useEffect(() => {
    let mounted = true;

    async function restoreReminders() {
      try {
        const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
        if (!mounted) return;
        if (stored) {
          setReminders(normalizeStoredReminders(stored));
        }
      } catch (error) {
        console.warn('Failed to restore pool reminders', error);
      } finally {
        if (mounted) setHydrated(true);
      }
    }

    restoreReminders();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders)).catch((error) => {
      console.warn('Failed to save pool reminders', error);
    });
  }, [hydrated, reminders]);

  const value = useMemo<ReminderContextValue>(
    () => ({
      hydrated,
      getReminder(poolId) {
        return reminders[poolId]?.frequency ?? 'off';
      },
      getReminderError(poolId) {
        return reminders[poolId]?.error;
      },
      getReminderInfo(poolId) {
        const entry = reminders[poolId];
        return {
          error: entry?.error,
          frequency: entry?.frequency ?? 'off',
          updatedAt: entry?.updatedAt,
        };
      },
      async setReminder(poolId, frequency, poolName) {
        const current = reminders[poolId];
        await cancelPoolReminderNotification(current?.notificationId);

        if (frequency === 'off') {
          setReminders((state) => ({
            ...state,
            [poolId]: {
              frequency,
              updatedAt: Date.now(),
            },
          }));
          return;
        }

        const result = await schedulePoolReminderNotification({
          frequency,
          poolId,
          poolName: poolName?.trim() || 'הבריכה שלך',
        });

        setReminders((current) => ({
          ...current,
          [poolId]: {
            error: result.error,
            frequency,
            notificationId: result.notificationId,
            updatedAt: Date.now(),
          },
        }));
      },
    }),
    [hydrated, reminders],
  );

  return <ReminderContext.Provider value={value}>{children}</ReminderContext.Provider>;
}

export function useReminders() {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminders must be used inside ReminderProvider');
  }
  return context;
}
