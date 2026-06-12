import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ReminderFrequency = 'off' | 'weekly' | 'biweekly' | 'monthly';

interface ReminderContextValue {
  hydrated: boolean;
  getReminder: (poolId: string) => ReminderFrequency;
  setReminder: (poolId: string, frequency: ReminderFrequency) => void;
}

const ReminderContext = createContext<ReminderContextValue | null>(null);
const REMINDER_STORAGE_KEY = '@aquasense/pool-reminders';

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [reminders, setReminders] = useState<Record<string, ReminderFrequency>>({});

  useEffect(() => {
    let mounted = true;

    async function restoreReminders() {
      try {
        const stored = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
        if (!mounted) return;
        if (stored) {
          const parsed = JSON.parse(stored) as Record<string, ReminderFrequency>;
          if (parsed && typeof parsed === 'object') {
            setReminders(parsed);
          }
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
        return reminders[poolId] ?? 'off';
      },
      setReminder(poolId, frequency) {
        setReminders((current) => ({
          ...current,
          [poolId]: frequency,
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
