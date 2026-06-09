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
  provider?: 'lovable';
  model?: string;
  confidence?: number;
  lowConfidence?: boolean;
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
