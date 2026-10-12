import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { acceptServiceConsent, ConsentVerificationError, fetchServiceConsent, setAiConsent, type ConsentFailureKind, type ServiceConsentStatus } from '../services/legalConsentService';

interface LegalConsentValue {
  status?: ServiceConsentStatus;
  checking: boolean;
  error: string;
  failureKind?: ConsentFailureKind;
  refresh: () => Promise<void>;
  accept: () => Promise<void>;
  chooseAi: (allowed: boolean) => Promise<void>;
}
const Context = createContext<LegalConsentValue | null>(null);
export function LegalConsentProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const ownerKey = isAuthenticated ? user?.id : undefined;
  const currentOwner = useRef(ownerKey);
  currentOwner.current = ownerKey;
  const [loadedOwner, setLoadedOwner] = useState<string>();
  const [status, setStatus] = useState<ServiceConsentStatus>();
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [failureKind, setFailureKind] = useState<ConsentFailureKind>();
  const run = useCallback(async (action: () => Promise<ServiceConsentStatus>) => {
    const owner = ownerKey;
    if (!owner) return;
    setChecking(true); setError(''); setFailureKind(undefined);
    try {
      const next = await action();
      if (currentOwner.current === owner) { setStatus(next); setLoadedOwner(owner); }
    } catch (err) {
      if (currentOwner.current === owner) {
        setError(err instanceof Error ? err.message : 'לא ניתן לאמת הסכמה.');
        setFailureKind(err instanceof ConsentVerificationError ? err.kind : 'verification');
      }
      throw err;
    } finally {
      if (currentOwner.current === owner) setChecking(false);
    }
  }, [ownerKey]);
  const refresh = useCallback(() => run(fetchServiceConsent), [run]);
  useEffect(() => {
    setStatus(undefined); setLoadedOwner(undefined); setError(''); setFailureKind(undefined);
    if (ownerKey) void refresh().catch(() => {});
  }, [ownerKey, refresh]);
  return <Context.Provider value={{
    status: loadedOwner === ownerKey ? status : undefined,
    checking, error, failureKind, refresh,
    accept: () => run(acceptServiceConsent),
    chooseAi: (allowed) => run(() => setAiConsent(allowed)),
  }}>{children}</Context.Provider>;
}
export function useLegalConsent() {
  const value = useContext(Context);
  if (!value) throw new Error('LegalConsentProvider required');
  return value;
}
