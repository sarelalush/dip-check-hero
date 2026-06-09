import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { DosageCalculationResult } from '../domain/dosage';
import type { StripAnalysisResult } from '../domain/scanResults';

// Parity source: src/utils/scanSession.ts and the web scan flow routes:
// select-strip, scan, scan-live, scan-confirm, select-pool, results.$testId.

export type ScanSessionStep = 'idle' | 'selectStrip' | 'scan' | 'confirm' | 'analyzing' | 'results';
export type ScanQualityStatus = 'unchecked' | 'needsReview' | 'passed';

export interface ScanSessionState {
  selectedPoolId?: string;
  selectedBrandId?: string;
  imageUri?: string;
  confirmedImageUri?: string;
  analysisResult?: StripAnalysisResult;
  dosageResult?: DosageCalculationResult;
  currentStep: ScanSessionStep;
  qualityStatus: ScanQualityStatus;
  qualityNotes: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface StartScanSessionInput {
  brandId?: string;
  poolId?: string;
}

interface ScanSessionContextValue {
  session: ScanSessionState;
  confirmImage: () => void;
  resetScanSession: () => void;
  setAnalysisResult: (result: StripAnalysisResult) => void;
  setImageUri: (imageUri?: string) => void;
  setSelectedBrand: (brandId: string) => void;
  setSelectedPool: (poolId: string) => void;
  startScanSession: (input?: StartScanSessionInput) => void;
}

const initialSession: ScanSessionState = {
  currentStep: 'idle',
  qualityNotes: [],
  qualityStatus: 'unchecked',
};

const ScanSessionContext = createContext<ScanSessionContextValue | null>(null);

function withTimestamp(session: ScanSessionState, timestamp = Date.now()): ScanSessionState {
  return {
    ...session,
    createdAt: session.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
}

export function ScanSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ScanSessionState>(initialSession);

  const startScanSession = useCallback((input: StartScanSessionInput = {}) => {
    const timestamp = Date.now();
    setSession({
      selectedBrandId: input.brandId,
      selectedPoolId: input.poolId,
      currentStep: 'selectStrip',
      qualityNotes: [],
      qualityStatus: 'unchecked',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }, []);

  const setSelectedBrand = useCallback((brandId: string) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        selectedBrandId: brandId,
        currentStep: 'selectStrip',
      }),
    );
  }, []);

  const setSelectedPool = useCallback((poolId: string) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        selectedPoolId: poolId,
      }),
    );
  }, []);

  const setImageUri = useCallback((imageUri?: string) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        analysisResult: undefined,
        confirmedImageUri: undefined,
        dosageResult: undefined,
        imageUri,
        currentStep: 'scan',
        qualityNotes: [],
        qualityStatus: 'unchecked',
      }),
    );
  }, []);

  const confirmImage = useCallback(() => {
    setSession((current) =>
      withTimestamp({
        ...current,
        confirmedImageUri: current.imageUri,
        currentStep: 'confirm',
        qualityNotes: ['הסטיק חד וברור', 'כל ריבועי הצבע נראים', 'התאורה טובה'],
        qualityStatus: 'passed',
      }),
    );
  }, []);

  const setAnalysisResult = useCallback((result: StripAnalysisResult) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        analysisResult: result,
        dosageResult: result.dosage,
        currentStep: 'results',
      }),
    );
  }, []);

  const resetScanSession = useCallback(() => {
    setSession(initialSession);
  }, []);

  const value = useMemo<ScanSessionContextValue>(
    () => ({
      session,
      confirmImage,
      resetScanSession,
      setAnalysisResult,
      setImageUri,
      setSelectedBrand,
      setSelectedPool,
      startScanSession,
    }),
    [
      confirmImage,
      resetScanSession,
      session,
      setAnalysisResult,
      setImageUri,
      setSelectedBrand,
      setSelectedPool,
      startScanSession,
    ],
  );

  return <ScanSessionContext.Provider value={value}>{children}</ScanSessionContext.Provider>;
}

export function useScanSession() {
  const context = useContext(ScanSessionContext);
  if (!context) {
    throw new Error('useScanSession must be used inside ScanSessionProvider');
  }
  return context;
}
