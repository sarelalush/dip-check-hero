import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripBrand } from '../domain/strip';
import type { ScanSessionState } from '../state/ScanSessionContext';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import { analyzeStripImageMock } from './mockAnalysisService';
import { uploadScanImage } from './scanImageStorage';

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
  testId?: string;
  userId?: string;
  brandId?: string;
  poolId?: string;
  imagePath?: string;
  imageUrl?: string;
  skipImageUpload?: boolean;
  qualityNotes?: string[];
  scanSession?: Pick<
    ScanSessionState,
    | 'confirmedImageUri'
    | 'createdAt'
    | 'currentStep'
    | 'imagePath'
    | 'imageUploadError'
    | 'imageUrl'
    | 'qualityStatus'
    | 'selectedBrandId'
    | 'selectedPoolId'
    | 'testId'
    | 'updatedAt'
  >;
  selectedBrand?: StripBrand;
}

export interface StripAnalysisServiceConfig {
  mode: StripAnalysisMode;
  remoteFunctionName: string;
}

const expoEnv = (typeof process !== 'undefined' ? process.env : {}) as Record<string, string | undefined>;
const configuredMode = expoEnv.EXPO_PUBLIC_STRIP_ANALYSIS_MODE;

const analysisConfig: StripAnalysisServiceConfig = {
  mode: configuredMode === 'remote' || configuredMode === 'native' ? configuredMode : 'mock',
  remoteFunctionName: expoEnv.EXPO_PUBLIC_STRIP_ANALYSIS_FUNCTION ?? 'analyze-strip',
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
  if (!isSupabaseConfigured) {
    return null;
  }

  const { data: userData } = await getSupabaseClient().auth.getUser();
  const userId = input.userId ?? userData.user?.id;
  const testId = input.testId ?? `remote-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let imagePath = input.imagePath;
  let imageUrl = input.imageUrl ?? (/^https?:\/\//i.test(input.imageUri) ? input.imageUri : undefined);

  if (!imagePath && !imageUrl && userId && !input.skipImageUpload) {
    try {
      const uploadedImage = await uploadScanImage({
        imageUri: input.imageUri,
        testId,
        userId,
      });

      imagePath = uploadedImage?.path;
      imageUrl = uploadedImage?.publicUrl;
    } catch (error) {
      console.warn('Remote strip analysis image upload failed, continuing with local image fallback', error);
    }
  }

  const { data, error } = await getSupabaseClient().functions.invoke(config.remoteFunctionName, {
    body: {
      testId,
      userId,
      poolId: input.poolId,
      brandId: input.brandId ?? input.selectedBrand?.id,
      imagePath,
      imageUrl,
      imageUri: input.imageUri,
      qualityNotes: input.qualityNotes,
      metadata: {
        scanSession: input.scanSession,
        selectedBrand: input.selectedBrand
          ? {
              id: input.selectedBrand.id,
              nameHe: input.selectedBrand.nameHe,
              parameters: input.selectedBrand.parameters,
            }
          : undefined,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!isRemoteAnalysisResponse(data)) {
    throw new Error('Remote analysis returned an unexpected response shape.');
  }

  return {
    ...data.result,
    imageUri: input.imageUri,
    imagePath: data.result.imagePath ?? imagePath,
    imageUrl: data.result.imageUrl ?? imageUrl,
  };
}

function isRemoteAnalysisResponse(value: unknown): value is { ok: true; result: StripAnalysisResult } {
  if (!value || typeof value !== 'object') return false;
  const payload = value as { ok?: unknown; result?: unknown };
  if (payload.ok !== true || !payload.result || typeof payload.result !== 'object') return false;

  const result = payload.result as Partial<StripAnalysisResult>;
  return (
    typeof result.id === 'string' &&
    typeof result.analyzedAt === 'number' &&
    Array.isArray(result.parameters) &&
    Boolean(result.overallStatus) &&
    typeof result.recommendation === 'string'
  );
}

async function analyzeStripImageNative(input: StripAnalysisInput): Promise<StripAnalysisResult | null> {
  // Future shape: run Expo/native image preprocessing + CV locally, then map
  // measurements into StripAnalysisResult. Browser canvas logic from the web app
  // cannot be used here directly.
  void input;
  return null;
}
