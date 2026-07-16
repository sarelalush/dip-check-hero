import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { getBrand } from '../config/stripBrands';
import type { DosageCalculationResult } from '../domain/dosage';
import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripBrand } from '../domain/strip';

// Parity source: src/utils/scanSession.ts and the web scan flow routes:
// select-strip, scan, scan-live, scan-confirm, select-pool, results.$testId.

export type ScanSessionStep = 'idle' | 'selectStrip' | 'scan' | 'confirm' | 'analyzing' | 'results';
export type ScanQualityStatus = 'unchecked' | 'needsReview' | 'passed';

export interface ScanSessionError {
  code:
    | 'missingBrand'
    | 'missingImage'
    | 'permissionDenied'
    | 'imagePickerFailed'
    | 'missingFrame'
    | 'stripOutsideFrame'
    | 'stripTooSmall'
    | 'notStraight'
    | 'blurry'
    | 'reflection'
    | 'notDetected'
    | 'processingFailed'
    | 'analysisFailed'
    | 'qualityFailed'
    | 'unknown';
  message: string;
}

export interface ScanSessionState {
  testId?: string;
  selectedPoolId?: string;
  selectedBrandId?: string;
  selectedBrand?: StripBrand;
  imageUri?: string;
  originalImageUri?: string;
  imageProcessingLog?: string[];
  confirmedImageUri?: string;
  imagePath?: string;
  imageUrl?: string;
  imageUploadError?: string;
  analysisResult?: StripAnalysisResult;
  dosageResult?: DosageCalculationResult;
  currentStep: ScanSessionStep;
  error?: ScanSessionError;
  qualityStatus: ScanQualityStatus;
  qualityNotes: string[];
  createdAt?: number;
  updatedAt?: number;
}

interface StartScanSessionInput {
  brandId?: string;
  poolId?: string;
}

interface SetImageUriOptions {
  originalImageUri?: string;
  processingLog?: string[];
}

interface ScanSessionContextValue {
  session: ScanSessionState;
  confirmImage: () => void;
  ensureTestId: () => string;
  resetScanSession: () => void;
  markQualityFailed: (notes: string[]) => void;
  setAnalysisResult: (result: StripAnalysisResult) => void;
  setScanError: (error?: ScanSessionError) => void;
  setCurrentStep: (step: ScanSessionStep) => void;
  setImageUri: (imageUri?: string, options?: SetImageUriOptions) => void;
  setScanImageUpload: (input: { imagePath?: string; imageUrl?: string; imageUploadError?: string; testId?: string }) => void;
  setQualityNotes: (notes: string[], status?: ScanQualityStatus) => void;
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

function createScanTestId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

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
    const selectedBrand = input.brandId ? getBrand(input.brandId) : undefined;
    setSession({
      selectedBrandId: input.brandId,
      selectedBrand,
      selectedPoolId: input.poolId,
      testId: createScanTestId(),
      currentStep: 'selectStrip',
      error: undefined,
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
        analysisResult: undefined,
        confirmedImageUri: undefined,
        dosageResult: undefined,
        error: undefined,
        imageUri: undefined,
        originalImageUri: undefined,
        imageProcessingLog: undefined,
        imagePath: undefined,
        imageUrl: undefined,
        imageUploadError: undefined,
        selectedBrandId: brandId,
        selectedBrand: getBrand(brandId),
        currentStep: 'selectStrip',
        qualityNotes: [],
        qualityStatus: 'unchecked',
      }),
    );
  }, []);

  const setSelectedPool = useCallback((poolId: string) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        selectedPoolId: poolId,
        error: undefined,
      }),
    );
  }, []);

  const setImageUri = useCallback((imageUri?: string, options: SetImageUriOptions = {}) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        analysisResult: undefined,
        confirmedImageUri: undefined,
        dosageResult: undefined,
        error: undefined,
        imageUri,
        originalImageUri: imageUri ? options.originalImageUri : undefined,
        imageProcessingLog: imageUri ? options.processingLog ?? [] : undefined,
        imagePath: undefined,
        imageUrl: undefined,
        imageUploadError: undefined,
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
        error: undefined,
        qualityNotes: ['הסטיק חד וברור', 'כל ריבועי הצבע נראים', 'התאורה טובה'],
        qualityStatus: 'passed',
      }),
    );
  }, []);

  const setQualityNotes = useCallback((notes: string[], status: ScanQualityStatus = 'needsReview') => {
    setSession((current) =>
      withTimestamp({
        ...current,
        qualityNotes: notes,
        qualityStatus: status,
      }),
    );
  }, []);

  const markQualityFailed = useCallback((notes: string[]) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        error: {
          code: 'qualityFailed',
          message: notes[0] ?? 'נדרש צילום ברור יותר לפני המשך הסריקה.',
        },
        qualityNotes: notes,
        qualityStatus: 'needsReview',
      }),
    );
  }, []);

  const setScanError = useCallback((error?: ScanSessionError) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        error,
      }),
    );
  }, []);

  const setCurrentStep = useCallback((step: ScanSessionStep) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        currentStep: step,
      }),
    );
  }, []);

  const ensureTestId = useCallback(() => {
    const generatedTestId = createScanTestId();
    let resolvedTestId = generatedTestId;

    setSession((current) => {
      resolvedTestId = current.testId ?? generatedTestId;
      return withTimestamp({
        ...current,
        testId: resolvedTestId,
      });
    });

    return resolvedTestId;
  }, []);

  const setScanImageUpload = useCallback(
    ({ imagePath, imageUrl, imageUploadError, testId }: { imagePath?: string; imageUrl?: string; imageUploadError?: string; testId?: string }) => {
      setSession((current) =>
        withTimestamp({
          ...current,
          testId: testId ?? current.testId,
          imagePath: imagePath ?? current.imagePath,
          imageUrl: imageUrl ?? current.imageUrl,
          imageUploadError,
        }),
      );
    },
    [],
  );

  const setAnalysisResult = useCallback((result: StripAnalysisResult) => {
    setSession((current) =>
      withTimestamp({
        ...current,
        testId: current.testId ?? result.id,
        analysisResult: result,
        dosageResult: result.dosage,
        error: undefined,
        imagePath: result.imagePath ?? current.imagePath,
        imageUrl: result.imageUrl ?? current.imageUrl,
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
      ensureTestId,
      markQualityFailed,
      resetScanSession,
      setAnalysisResult,
      setScanError,
      setCurrentStep,
      setImageUri,
      setScanImageUpload,
      setQualityNotes,
      setSelectedBrand,
      setSelectedPool,
      startScanSession,
    }),
    [
      confirmImage,
      ensureTestId,
      markQualityFailed,
      resetScanSession,
      session,
      setAnalysisResult,
      setScanError,
      setCurrentStep,
      setImageUri,
      setScanImageUpload,
      setQualityNotes,
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
