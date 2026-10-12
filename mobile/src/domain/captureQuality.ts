export interface CaptureMetadata {
  source: 'camera' | 'gallery';
  capturedAt?: number;
  dippedAt?: number;
  readDelaySeconds?: number;
  timing: 'timer' | 'userConfirmed' | 'unknown';
}

export interface ImageQualityReport {
  version: 'capture-quality-v1';
  status: 'checked' | 'blocked' | 'unavailable';
  width: number;
  height: number;
  warnings: string[];
  blockers: string[];
  meanLuminance?: number;
  darkFraction?: number;
  clippedFraction?: number;
  edgeEnergy?: number;
}
