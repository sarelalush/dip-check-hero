import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripBrand } from '../domain/strip';
import type { ScanSessionState } from '../state/ScanSessionContext';
import { analyzeStripImageMock } from './mockAnalysisService';

// Parity sources:
// - src/utils/analyzeStripImage.ts
// - src/utils/colorUtils.ts
// - src/utils/whiteBalance.ts
// - src/utils/isolateStrip.ts
// - src/utils/cropToWhite.ts
// - src/utils/frameQuality.ts
// - src/lib/strip-analysis.functions.ts
// - src/routes/scan-confirm.tsx
// - src/routes/results.$testId.tsx
//
// Web-only pieces that must be rewritten for Expo/native before real analysis:
// canvas / CanvasRenderingContext2D, HTMLImageElement, FileReader, Blob,
// navigator.mediaDevices, document-created canvases, and direct DOM cropper logic.
// Native replacements should use Expo-compatible image manipulation, camera,
// and a remote service or native CV module instead of browser primitives.

export type StripAnalysisMode = 'mock' | 'remote' | 'native';

export interface StripAnalysisInput {
  imageUri: string;
  brandId?: string;
  poolId?: string;
  qualityNotes?: string[];
  scanSession?: Pick<
    ScanSessionState,
    | 'confirmedImageUri'
    | 'createdAt'
    | 'currentStep'
    | 'qualityStatus'
    | 'selectedBrandId'
    | 'selectedPoolId'
    | 'updatedAt'
  >;
  selectedBrand?: StripBrand;
}

export interface StripAnalysisServiceConfig {
  mode: StripAnalysisMode;
  remoteEndpoint?: string;
}

const analysisConfig: StripAnalysisServiceConfig = {
  mode: 'mock',
};

export function getStripAnalysisConfig() {
  return analysisConfig;
}

export async function analyzeStripImage(input: StripAnalysisInput): Promise<StripAnalysisResult> {
  if (analysisConfig.mode === 'remote') {
    try {
      const remoteResult = await analyzeStripImageRemote(input, analysisConfig);
      if (remoteResult) {
        return remoteResult;
      }
    } catch (error) {
      console.warn('Remote strip analysis failed, falling back to mock analysis', error);
    }
  }

  if (analysisConfig.mode === 'native') {
    try {
      const nativeResult = await analyzeStripImageNative(input);
      if (nativeResult) {
        return nativeResult;
      }
    } catch (error) {
      console.warn('Native strip analysis failed, falling back to mock analysis', error);
    }
  }

  return analyzeStripImageMock({
    brandId: input.brandId,
    imageUri: input.imageUri,
    poolId: input.poolId,
  });
}

async function analyzeStripImageRemote(
  input: StripAnalysisInput,
  config: StripAnalysisServiceConfig,
): Promise<StripAnalysisResult | null> {
  if (!config.remoteEndpoint) {
    return null;
  }

  // Future shape: POST { imageUri/base64, brandId, poolId, qualityNotes,
  // selectedBrand, scanSession } and map the response into StripAnalysisResult.
  // No endpoint is configured for mobile yet, so this intentionally falls back.
  void input;
  return null;
}

async function analyzeStripImageNative(input: StripAnalysisInput): Promise<StripAnalysisResult | null> {
  // Future shape: run Expo/native image preprocessing + CV locally, then map
  // measurements into StripAnalysisResult. Browser canvas logic from the web app
  // cannot be used here directly.
  void input;
  return null;
}
