import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { dpdFollowUpIssue, type DpdReading } from '../domain/chlorineShock';

export interface TreatmentRecord {
  testId: string;
  poolId: string;
  actionText: string;
  performedAt: number;
  retestAt?: number;
  notificationId?: string;
  // Earliest time to sample again for another computed portion, when the
  // supported treatment has a known minimum. This is not swim clearance.
  doseRetestNotBefore?: number;
  kind?: 'chlorine-shock';
  // A recorded full shock needs a new quantitative DPD review before automatic
  // maintenance resumes. This local check is not a bathing authorization.
  requiresDpdFollowUp?: boolean;
  dpdFollowUp?: DpdReading;
}
interface TreatmentContextValue {
  hydrated: boolean;
  error?: string;
  getTreatment: (testId: string) => TreatmentRecord | undefined;
  getLatestPoolTreatment: (poolIds: string[]) => TreatmentRecord | undefined;
  saveTreatment: (record: TreatmentRecord) => Promise<void>;
}
const TreatmentContext = createContext<TreatmentContextValue | null>(null);

export function TreatmentProvider({ children }: { children: ReactNode }) {
  const { accountId, user } = useAuth();
  const owner = accountId && user?.id ? `${user.id}:${accountId}` : undefined;
  const [storedOwner, setStoredOwner] = useState<string>();
  const [records, setRecords] = useState<TreatmentRecord[]>([]);
  const [error, setError] = useState<string>();
  const current = useRef<{ owner?: string; records: TreatmentRecord[] }>({ records: [] });
  const identity = useRef(owner);
  identity.current = owner;
  const saving = useRef(false);
  useEffect(() => {
    let active = true;
    let loaded = false;
    current.current = { owner: undefined, records: [] };
    setStoredOwner(undefined);
    setRecords([]);
    setError(undefined);
    if (owner)
      void AsyncStorage.getItem(`@aquasense/treatments:${owner}`)
        .then((value) => {
          if (!active) return;
          const parsed: unknown = value ? JSON.parse(value) : [];
          const restored = Array.isArray(parsed)
            ? parsed
                .filter(
                  (item): item is TreatmentRecord =>
                    item &&
                    typeof item.testId === 'string' &&
                    typeof item.poolId === 'string' &&
                    typeof item.actionText === 'string' &&
                    Number.isFinite(item.performedAt),
                )
                .map((item) => {
                  if (item.kind !== 'chlorine-shock') return item;
                  const followUp = item.dpdFollowUp;
                  const reviewed = item.requiresDpdFollowUp === false && followUp &&
                    Number.isFinite(followUp.measuredAt) && followUp.measuredAt > item.performedAt &&
                    !dpdFollowUpIssue(followUp);
                  return { ...item, requiresDpdFollowUp: !reviewed, dpdFollowUp: reviewed ? followUp : undefined };
                })
                .slice(0, 200)
            : [];
          current.current = { owner, records: restored };
          loaded = true;
          setRecords(restored);
        })
        .catch(() => {
          if (active)
            setError(
              'לא הצלחנו לטעון את תיעוד הטיפולים. פתח את האפליקציה מחדש לפני תיעוד פעולה נוספת.',
            );
        })
        .finally(() => {
          if (active && loaded) {
            current.current.owner = owner;
            setStoredOwner(owner);
          }
        });
    return () => {
      active = false;
    };
  }, [owner]);

  const value = useMemo<TreatmentContextValue>(
    () => ({
      hydrated: Boolean(owner && storedOwner === owner),
      error,
      getTreatment: (testId) =>
        storedOwner === owner ? records.find((record) => record.testId === testId) : undefined,
      getLatestPoolTreatment: (poolIds) => storedOwner === owner
        ? records.filter(record => poolIds.includes(record.poolId))
          .reduce<TreatmentRecord | undefined>((latest, record) =>
            !latest || record.performedAt > latest.performedAt ? record : latest, undefined)
        : undefined,
      async saveTreatment(record) {
        if (!owner || storedOwner !== owner || current.current.owner !== owner || saving.current)
          throw new Error('לא ניתן לשמור כרגע. נסה שוב בעוד רגע.');
        saving.current = true;
        try {
          const updated = [
            record,
            ...current.current.records.filter((item) => item.testId !== record.testId),
          ].slice(0, 200);
          await AsyncStorage.setItem(`@aquasense/treatments:${owner}`, JSON.stringify(updated));
          if (identity.current !== owner) throw new Error('החשבון השתנה. פתח את התוצאה מחדש.');
          current.current = { owner, records: updated };
          setRecords(updated);
        } finally {
          saving.current = false;
        }
      },
    }),
    [error, owner, records, storedOwner],
  );
  return <TreatmentContext.Provider value={value}>{children}</TreatmentContext.Provider>;
}
export function useTreatments() {
  const context = useContext(TreatmentContext);
  if (!context) throw new Error('TreatmentProvider is required');
  return context;
}
