import type { StatusTone } from '../components/StatusBadge';

export type ScanParameterKey = 'ph' | 'chlorine' | 'alkalinity' | 'salt';

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
  poolId?: string;
  overallStatus: {
    label: string;
    tone: StatusTone;
  };
  parameters: ScanResultParameter[];
  recommendation: string;
}

