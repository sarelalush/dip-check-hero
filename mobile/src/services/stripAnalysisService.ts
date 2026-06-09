import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripBrand } from '../domain/strip';
import type { ScanSessionState } from '../state/ScanSessionContext';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import { analyzeStripImageMock } from './mockAnalysisService';
import { isLocalUploadCandidate, uploadScanImage } from './scanImageStorage';

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

export type StripAnalysisMode = 'auto' | 'mock' | 'remote' | 'native';

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
const configuredFunctionName = expoEnv.EXPO_PUBLIC_STRIP_ANALYSIS_FUNCTION?.trim();

const analysisConfig: StripAnalysisServiceConfig = {
  mode:
    configuredMode === 'mock' || configuredMode === 'remote' || configuredMode === 'native' || configuredMode === 'auto'
      ? configuredMode
      : 'auto',
  remoteFunctionName: configuredFunctionName || 'analyze-strip',
};

export function getStripAnalysisConfig() {
  return analysisConfig;
}

function logAnalysisDebug(message: string, details?: Record<string, unknown>) {
  if (expoEnv.NODE_ENV !== 'production') {
    console.log(`[strip-analysis] ${message}`, details ?? {});
  }
}

export async function analyzeStripImage(input: StripAnalysisInput): Promise<StripAnalysisResult> {
  logAnalysisDebug('selected analysis mode', {
    mode: analysisConfig.mode,
    hasFunctionName: Boolean(analysisConfig.remoteFunctionName),
    hasImagePath: Boolean(input.imagePath),
    hasImageUrl: Boolean(input.imageUrl),
    hasLocalUploadCandidate: isLocalUploadCandidate(input.imageUri),
    hasInputUserId: Boolean(input.userId),
    isSupabaseConfigured,
  });

  if (analysisConfig.mode === 'mock') {
    logAnalysisDebug('using mock mode by override');
    const mockResult = await analyzeStripImageMock({
      brandId: input.brandId,
      imageUri: input.imageUri,
      poolId: input.poolId,
    });
    logAnalysisDebug('analysis result selected', {
      source: mockResult.source ?? 'mock',
      confidence: mockResult.confidence,
      remoteAttempted: false,
    });
    return mockResult;
  }

  if (analysisConfig.mode === 'remote' || analysisConfig.mode === 'auto') {
    try {
      const remoteResult = await analyzeStripImageRemote(input, analysisConfig, {
        requireAuthenticatedUser: analysisConfig.mode === 'auto',
        requireImageReference: analysisConfig.mode === 'auto',
      });
      if (remoteResult) {
        logAnalysisDebug('analysis result selected', {
          source: remoteResult.source ?? 'remote',
          confidence: remoteResult.confidence,
          remoteAttempted: true,
        });
        return remoteResult;
      }
      logAnalysisDebug('remote analysis skipped, falling back to mock', {
        mode: analysisConfig.mode,
      });
    } catch (error) {
      console.warn('Remote strip analysis failed, falling back to mock analysis', error);
      logAnalysisDebug('remote analysis failed, falling back to mock', {
        error: error instanceof Error ? error.message : String(error),
      });
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

  const fallbackResult = await analyzeStripImageMock({
    brandId: input.brandId,
    imageUri: input.imageUri,
    poolId: input.poolId,
  });
  logAnalysisDebug('analysis result selected', {
    source: fallbackResult.source ?? 'mock',
    confidence: fallbackResult.confidence,
    remoteAttempted: analysisConfig.mode === 'remote' || analysisConfig.mode === 'auto',
    fallback: true,
  });
  return fallbackResult;
}

async function analyzeStripImageRemote(
  input: StripAnalysisInput,
  config: StripAnalysisServiceConfig,
  options: { requireAuthenticatedUser?: boolean; requireImageReference?: boolean } = {},
): Promise<StripAnalysisResult | null> {
  if (!isSupabaseConfigured || !config.remoteFunctionName) {
    logAnalysisDebug('remote not attempted', {
      reason: !isSupabaseConfigured ? 'supabase-not-configured' : 'missing-function-name',
    });
    return null;
  }

  const { data: userData } = await getSupabaseClient().auth.getUser();
  const userId = input.userId ?? userData.user?.id;
  if (options.requireAuthenticatedUser && !userId) {
    logAnalysisDebug('remote not attempted', {
      reason: 'missing-authenticated-user',
    });
    return null;
  }

  const testId = input.testId ?? `remote-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let imagePath = input.imagePath;
  let imageUrl = input.imageUrl ?? (/^https?:\/\//i.test(input.imageUri) ? input.imageUri : undefined);
  const canUploadLocalImage = Boolean(userId && isLocalUploadCandidate(input.imageUri));

  if (options.requireImageReference && !imagePath && !imageUrl && !canUploadLocalImage) {
    logAnalysisDebug('remote not attempted', {
      reason: 'missing-image-reference',
      hasUserId: Boolean(userId),
      hasLocalUploadCandidate: canUploadLocalImage,
    });
    return null;
  }

  if (!imagePath && !imageUrl && userId && !input.skipImageUpload) {
    try {
      logAnalysisDebug('uploading local image before remote analysis', {
        testId,
      });
      const uploadedImage = await uploadScanImage({
        imageUri: input.imageUri,
        testId,
        userId,
      });

      imagePath = uploadedImage?.path;
      imageUrl = uploadedImage?.publicUrl;
    } catch (error) {
      console.warn('Remote strip analysis image upload failed, continuing with local image fallback', error);
      logAnalysisDebug('remote image upload failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (options.requireImageReference && !imagePath && !imageUrl) {
    logAnalysisDebug('remote not attempted', {
      reason: 'image-upload-did-not-produce-path-or-url',
    });
    return null;
  }

  logAnalysisDebug('invoking remote analysis function', {
    functionName: config.remoteFunctionName,
    hasImagePath: Boolean(imagePath),
    hasImageUrl: Boolean(imageUrl),
    testId,
  });

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

  logAnalysisDebug('remote analysis response received', {
    source: data.result.source ?? 'remote',
    confidence: data.result.confidence,
  });

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
