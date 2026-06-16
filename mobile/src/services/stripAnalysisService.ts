import type { StripAnalysisResult } from '../domain/scanResults';
import type { StripBrand } from '../domain/strip';
import type { ScanSessionState } from '../state/ScanSessionContext';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import { isLocalUploadCandidate, readLocalImageAsDataUrl, uploadScanImage } from './scanImageStorage';

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
  accountId?: string;
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

export class StripAnalysisServiceError extends Error {
  code: 'unavailable' | 'invalid_strip';

  constructor(code: 'unavailable' | 'invalid_strip', message: string) {
    super(message);
    this.code = code;
    this.name = 'StripAnalysisServiceError';
  }
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

function isDirectRemoteImageCandidate(uri?: string) {
  return Boolean(uri && (uri.startsWith('data:image/') || /^https?:\/\//i.test(uri)));
}

export async function analyzeStripImage(input: StripAnalysisInput): Promise<StripAnalysisResult> {
  logAnalysisDebug('selected analysis mode', {
    mode: analysisConfig.mode,
    hasFunctionName: Boolean(analysisConfig.remoteFunctionName),
    hasImagePath: Boolean(input.imagePath),
    hasImageUrl: Boolean(input.imageUrl),
    hasDirectImageUri: isDirectRemoteImageCandidate(input.imageUri),
    hasLocalUploadCandidate: isLocalUploadCandidate(input.imageUri),
    hasInputUserId: Boolean(input.userId),
    isSupabaseConfigured,
  });

  if (analysisConfig.mode === 'mock' || analysisConfig.mode === 'native') {
    throw new StripAnalysisServiceError(
      'unavailable',
      'שירות הניתוח אינו זמין כרגע באפליקציה. נסו שוב בעוד כמה דקות.',
    );
  }

  if (analysisConfig.mode === 'remote' || analysisConfig.mode === 'auto') {
    try {
      const remoteResult = await analyzeStripImageRemote(input, analysisConfig, {
        requireAuthenticatedUser: analysisConfig.mode === 'auto' && !isDirectRemoteImageCandidate(input.imageUri),
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
      logAnalysisDebug('remote analysis unavailable', {
        mode: analysisConfig.mode,
      });
    } catch (error) {
      if (error instanceof StripAnalysisServiceError) {
        throw error;
      }
      console.warn('Remote strip analysis failed', error);
      logAnalysisDebug('remote analysis failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new StripAnalysisServiceError(
    'unavailable',
    'שירות הניתוח אינו זמין כרגע. אנא נסו שוב בעוד כמה דקות.',
  );
}

async function analyzeStripImageRemote(
  input: StripAnalysisInput,
  config: StripAnalysisServiceConfig,
  options: { requireAuthenticatedUser?: boolean; requireImageReference?: boolean } = {},
): Promise<StripAnalysisResult | null> {
  if (!isSupabaseConfigured || !config.remoteFunctionName) {
    throw new StripAnalysisServiceError(
      'unavailable',
      !isSupabaseConfigured
        ? 'שירות הניתוח אינו מוגדר כרגע באפליקציה.'
        : 'שירות הניתוח אינו זמין כרגע.',
    );
  }

  const { data: userData } = await getSupabaseClient().auth.getUser();
  const userId = input.userId ?? userData.user?.id;
  if (options.requireAuthenticatedUser && !userId) {
    throw new StripAnalysisServiceError('unavailable', 'יש להתחבר כדי לבצע ניתוח AI.');
  }

  const testId = input.testId ?? `remote-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  let imagePath = input.imagePath;
  let imageUrl = input.imageUrl ?? (/^https?:\/\//i.test(input.imageUri) ? input.imageUri : undefined);
  let imageUriForRemote = input.imageUri;
  const hasDirectImageUri = isDirectRemoteImageCandidate(input.imageUri);
  const canUploadLocalImage = Boolean(input.accountId && userId && isLocalUploadCandidate(input.imageUri));

  if (options.requireImageReference && !imagePath && !imageUrl && !hasDirectImageUri && !canUploadLocalImage) {
    throw new StripAnalysisServiceError(
      'invalid_strip',
      'לא הצלחנו להכין את תמונת הסטיק לניתוח. יש לצלם שוב תמונה ברורה של סטיק מלא בתוך המסגרת.',
    );
  }

  if (!imagePath && !imageUrl && userId && !input.skipImageUpload) {
    try {
      logAnalysisDebug('uploading local image before remote analysis', {
        testId,
      });
      const uploadedImage = await uploadScanImage({
        accountId: input.accountId,
        imageUri: input.imageUri,
        testId,
        userId,
      });

      imagePath = uploadedImage?.path;
      imageUrl = uploadedImage?.publicUrl;
    } catch (error) {
      console.warn('Remote strip analysis image upload failed', error);
      throw new StripAnalysisServiceError(
        'unavailable',
        'לא הצלחנו להעלות את תמונת הסטיק לניתוח. השירות אינו זמין כרגע.',
      );
    }
  }

  if (!imagePath && !imageUrl && !isDirectRemoteImageCandidate(imageUriForRemote) && isLocalUploadCandidate(input.imageUri)) {
    try {
      logAnalysisDebug('encoding local image as data URL for remote analysis', {
        testId,
      });
      const localDataUrl = await readLocalImageAsDataUrl(input.imageUri);
      if (localDataUrl?.dataUrl) {
        imageUriForRemote = localDataUrl.dataUrl;
      }
    } catch (error) {
      console.warn('Remote strip analysis data-url fallback failed', error);
      throw new StripAnalysisServiceError(
        'unavailable',
        'לא הצלחנו להכין את התמונה לניתוח AI. השירות אינו זמין כרגע.',
      );
    }
  }

  const hasRemoteReadableImageUri = isDirectRemoteImageCandidate(imageUriForRemote);

  if (options.requireImageReference && !imagePath && !imageUrl && !hasRemoteReadableImageUri) {
    throw new StripAnalysisServiceError(
      'invalid_strip',
      'לא התקבלה תמונת סטיק תקינה לניתוח. יש לצלם שוב סטיק ברור ומלא.',
    );
  }

  logAnalysisDebug('invoking remote analysis function', {
    functionName: config.remoteFunctionName,
    hasImagePath: Boolean(imagePath),
    hasImageUrl: Boolean(imageUrl),
    hasDirectImageUri: hasRemoteReadableImageUri,
    testId,
  });

  const { data, error } = await getSupabaseClient().functions.invoke(config.remoteFunctionName, {
    body: {
      testId,
      accountId: input.accountId,
      userId,
      poolId: input.poolId,
      brandId: input.brandId ?? input.selectedBrand?.id,
      imagePath,
      imageUrl,
      imageUri: imageUriForRemote,
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
    const errorPayload = await readFunctionInvokeErrorPayload(error);
    if (isRemoteAnalysisErrorResponse(errorPayload)) {
      throw new StripAnalysisServiceError(
        errorPayload.code === 'invalid_strip' ? 'invalid_strip' : 'unavailable',
        errorPayload.message,
      );
    }

    throw new StripAnalysisServiceError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.');
  }

  if (isRemoteAnalysisErrorResponse(data)) {
    throw new StripAnalysisServiceError(
      data.code === 'invalid_strip' ? 'invalid_strip' : 'unavailable',
      data.message,
    );
  }

  if (!isRemoteAnalysisResponse(data)) {
    throw new StripAnalysisServiceError('unavailable', 'שירות הניתוח החזיר תשובה לא תקינה.');
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

function isRemoteAnalysisErrorResponse(
  value: unknown,
): value is { ok: false; code: 'unavailable' | 'invalid_strip'; message: string } {
  if (!value || typeof value !== 'object') return false;
  const payload = value as { ok?: unknown; code?: unknown; message?: unknown };
  return payload.ok === false && typeof payload.code === 'string' && typeof payload.message === 'string';
}

async function readFunctionInvokeErrorPayload(error: unknown): Promise<unknown> {
  if (!error || typeof error !== 'object') return undefined;
  const maybeContext = (error as { context?: unknown }).context;
  if (!maybeContext || typeof maybeContext !== 'object') return undefined;

  const response = maybeContext as {
    clone?: () => { json?: () => Promise<unknown> };
    json?: () => Promise<unknown>;
  };

  try {
    if (typeof response.clone === 'function') {
      const cloned = response.clone();
      if (cloned && typeof cloned.json === 'function') {
        return await cloned.json();
      }
    }

    if (typeof response.json === 'function') {
      return await response.json();
    }
  } catch {
    return undefined;
  }

  return undefined;
}
