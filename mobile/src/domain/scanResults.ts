import type { StatusTone } from '../components/StatusBadge';
import type { DosageCalculationResult } from './dosage';
import type { StripParameter } from './strip';

export type ScanParameterKey = StripParameter;

export type ScanParameterStatusKind = 'ok' | 'low' | 'high';

export interface ScanIdealRange {
  min: number;
  max: number;
  label: string;
}

export interface ScanParameterStatus {
  kind: ScanParameterStatusKind;
  label: string;
  tone: StatusTone;
}

export interface ScanResultParameter {
  key: ScanParameterKey;
  name: string;
  value: number;
  unit: string;
  idealRange: ScanIdealRange;
  status: ScanParameterStatus;
  recommendation: string;
  progress: number;
  confidence?: number;
  evidence?: ParameterAnalysisEvidence;
}

export interface ParameterAnalysisEvidence {
  chartValues: number[];
  rawValues: number[];
  snappedValues: number[];
  selectedValue?: number;
  agreementCount: number;
  requiredAgreement: number;
}

export interface AnalysisEvidence {
  method: 'repeated-model-discrete-consensus';
  requiredRuns: number;
  successfulRuns: number;
  runConfidences: number[];
  requiredParameters: ScanParameterKey[];
  parameters: Partial<Record<ScanParameterKey, ParameterAnalysisEvidence>>;
}

export interface StripAnalysisResult {
  id: string;
  analyzedAt: number;
  brandId?: string;
  imageUri?: string;
  imagePath?: string;
  imageUrl?: string;
  poolId?: string;
  source?: 'mock' | 'remote-mock' | 'remote-v1' | 'remote' | 'native' | 'ai' | 'cv';
  provider?: 'gemini';
  model?: string;
  confidence?: number;
  analysisVersion?: string;
  accepted?: boolean;
  acceptanceReasons?: string[];
  evidence?: AnalysisEvidence;
  lowConfidence?: boolean;
  isValidStrip?: boolean;
  failureReason?:
    | 'none'
    | 'not_strip'
    | 'blurry'
    | 'lighting'
    | 'framing'
    | 'low_confidence'
    | 'unsupported_strip'
    | 'ai_error'
    | 'unknown';
  notes?: string;
  shotsUsed?: number;
  overallStatus: {
    label: string;
    tone: StatusTone;
  };
  parameters: ScanResultParameter[];
  recommendation: string;
  dosage?: DosageCalculationResult;
}
