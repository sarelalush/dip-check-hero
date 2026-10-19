// Web-parity remote strip analysis for Supabase Edge Functions.
//
// Source-of-truth web files:
// - src/utils/analyzeStripImage.ts
// - src/lib/strip-analysis.functions.ts
// - src/utils/colorUtils.ts
// - src/config/brandSwatches.ts
// - src/config/stripBrands.ts
// - src/config/targetRanges.ts
//
// Pipeline:
// 1. Download the uploaded image from Storage or imageUrl.
// 2. Load the versioned reference and send the image to Gemini exactly once.
// 3. For Pro, read discrete chart levels from ordinary phone photographs.
//    Pixel comparison is diagnostic: an uncalibrated RGB mismatch is not a veto.
// 4. If the provider is unavailable, return a service-unavailable response.
//
// Required secrets for AI mode:
// - GEMINI_API_KEY for direct server-side Gemini API access.
// - STRIP_AI_PROVIDER=gemini is optional; Gemini is the only production provider.
// - GEMINI_MODEL_PRIMARY is optional; defaults to gemini-3.5-flash.
// Mobile never receives the Gemini key. It only invokes this Edge Function.
//
// This is V1, not lab-grade analysis. Future versions should improve strip
// detection, rotation handling, pad localization, lighting calibration, and
// chart calibration per physical strip/bottle lot. No browser APIs are used.

import { Image as ImageScript } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import bundledProChart from '../_shared/aquachek-pro-chart.json' with { type: 'json' };
import bundledProReferenceImage from '../_shared/aquachek-pro-reference-image.json' with { type: 'json' };
import { parseProColorChart, buildProChartPrompt, PRO_METRICS, type ProColorChart } from '../_shared/strip-color-reference.ts';
import { alignPadColorBoxes } from '../_shared/pad-color-geometry.ts';
import {
  AQUACHEK_PRO_REFS as PRO_REFS,
  analyzeAquachekProDiscretePadRgbs,
  analyzeAquachekProStructure,
  bestMatch,
  confidenceFromDistances,
  getPadBoxSampleRegions,
  getFixedPadSampleRegions,
  getLocalizedPadSampleRegions,
  locateAquachekProStripCenterX,
  evaluateAquachekReadability,
  measureAquachekProSharpness,
  measureAquachekPadFocus,
  robustRgbFromSamples,
} from '../_shared/aquachek-pro-reference.js';
import { readZeroBasedImageScriptRgb } from '../_shared/imagescript-pixel.js';
import {
  MAX_IMAGE_BYTES, MAX_ANALYSIS_REQUEST_BYTES, UUID_PATTERN,
  readBoundedBytes, readBoundedJson, userHeaders, requireAnalysisConsent, validateImage,
} from '../_shared/request-security.ts';

type StatusTone = 'success' | 'warning' | 'danger';
type AnalysisSource = 'ai';
type AiProviderName = 'gemini';
type FailureReason =
  | 'none'
  | 'not_strip'
  | 'blurry'
  | 'lighting'
  | 'framing'
  | 'low_confidence'
  | 'unsupported_strip'
  | 'ai_error'
  | 'unknown';
type StripParameter =
  | 'freeChlorine'
  | 'totalChlorine'
  | 'bromine'
  | 'ph'
  | 'alkalinity'
  | 'cyanuricAcid'
  | 'hardness'
  | 'salt';

type Rgb = [number, number, number];

interface AnalyzeStripRequest {
  testId: string;
  accountId?: string;
  userId?: string;
  poolId?: string;
  brandId?: string;
  imagePath?: string;
  imageUrl?: string;
  imageUri?: string;
  qualityNotes?: string[];
  metadata?: Record<string, unknown>;
}

interface StripBrand {
  id: string;
  nameHe: string;
  parameters: StripParameter[];
}

interface ScanResultParameter {
  key: StripParameter;
  name: string;
  value: number;
  unit: string;
  idealRange: {
    min: number;
    max: number;
    label: string;
  };
  status: {
    kind: 'ok' | 'low' | 'high';
    label: string;
    tone: StatusTone;
  };
  recommendation: string;
  progress: number;
  confidence?: number;
  evidence?: ParameterAnalysisEvidence;
}

interface ParameterAnalysisEvidence {
  chartValues: number[];
  rawValues: number[];
  snappedValues: number[];
  selectedValue?: number;
  agreementCount: number;
  requiredAgreement: number;
  colorDistance?: number;
  colorMargin?: number;
  referenceRgb?: Rgb;
  confidenceBasis?: 'model-reported';
  colorComparisonValue?: number;
  colorAgrees?: boolean;
  needsVerification?: boolean;
  modelCertainty?: 'clear' | 'adjacent' | 'unreadable';
  alternativeValue?: number;
  observedColor?: string;
}

interface ColorAnalysisEvidence {
  imageWidth?: number;
  imageHeight?: number;
  confidence: number;
  distances: Partial<Record<StripParameter, number>>;
  margins: Partial<Record<StripParameter, number>>;
  padRgbs: Rgb[];
  selectedValues: Partial<Record<StripParameter, number>>;
  padCenterYs?: number[];
  modelPadCenterYs?: number[];
  modelPadBoxes?: NormalizedPadBox[];
  padLocalization?: 'model-boxes' | 'structure-refined';
  padColorIdentity?: 'structure-aligned' | 'unverified';
  sampledPadBoxes?: NormalizedPadBox[];
  localizationCandidates?: Array<{
    confidence: number;
    padCenterYs?: number[];
    padLocalization: 'model-boxes' | 'structure-refined';
  }>;
  whiteReference?: Rgb;
  sharpnessVariance?: number;
  padFocus?: ReturnType<typeof measureAquachekPadFocus>;
  minimumSharpnessVariance?: number;
  hardMinimumSharpnessVariance?: number;
  structure?: ReturnType<typeof analyzeAquachekProStructure>;
  horizontalLocalization?: ReturnType<typeof locateAquachekProStripCenterX>;
  deskewAngle?: number;
}

interface AnalysisEvidence {
  padReadings?: ModelPadReading[];
  referenceRevision?: string;
  calibrationStatus?: ProColorChart['calibrationStatus'];
  method:
    | 'repeated-model-discrete-consensus'
    | 'repeated-model-chart-consensus'
    | 'gemini-quality-deterministic-color'
    | 'gemini-pad-boxes-deterministic-color'
    | 'model-and-reference-color-consensus'
    | 'model-chart-with-color-diagnostics';
  requiredRuns: number;
  successfulRuns: number;
  qualityPassedRuns: number;
  confidencePassedRuns: number;
  runConfidences: number[];
  expectedPhysicalPadCount: number;
  detectedPhysicalPadCounts: number[];
  fullyVisiblePadRuns: number;
  singleStripRuns: number;
  continuousBodyRuns: number;
  intactPadRuns: number;
  correctPadOrderRuns: number;
  noExtraPadRuns: number;
  requiredParameters: StripParameter[];
  parameters: Partial<Record<StripParameter, ParameterAnalysisEvidence>>;
  colorAnalysis?: ColorAnalysisEvidence;
  referenceImageIncluded?: boolean;
  diagnosticWarnings?: string[];
}

interface StripAnalysisResult {
  id: string;
  analyzedAt: number;
  brandId?: string;
  imageUri?: string;
  imagePath?: string;
  imageUrl?: string;
  poolId?: string;
  source: AnalysisSource;
  provider?: AiProviderName;
  model?: string;
  confidence: number;
  analysisVersion?: string;
  accepted?: boolean;
  acceptanceReasons?: string[];
  evidence?: AnalysisEvidence;
  lowConfidence?: boolean;
  isValidStrip?: boolean;
  failureReason?: FailureReason;
  notes?: string;
  shotsUsed?: number;
  overallStatus: {
    label: string;
    tone: StatusTone;
  };
  parameters: ScanResultParameter[];
  recommendation: string;
  tokenUsage?: GeminiTokenUsageSummary;
}

type StripAnalysisRequestStatus = 'processing' | 'completed' | 'failed' | 'conflict';

interface StripAnalysisClaim {
  claimed: boolean;
  status: StripAnalysisRequestStatus;
  canonicalTestId?: string;
  result?: StripAnalysisResult;
  errorCode?: string;
  errorMessage?: string;
}

interface StripAnalysisRequestRow {
  status: Exclude<StripAnalysisRequestStatus, 'conflict'>;
  result?: StripAnalysisResult | null;
  error_code?: string | null;
  error_message?: string | null;
}

interface AiRunData {
  isStrip: boolean;
  failureReason: FailureReason;
  physicalPadCount: number;
  allPadsFullyVisible: boolean;
  hasExactlyOneStrip: boolean;
  hasSingleContinuousStripBody: boolean;
  allPadsIntact: boolean;
  padOrderMatchesSelectedBrand: boolean;
  hasExtraPadLikeRegions: boolean;
  visiblePadBoxes: NormalizedPadBox[];
  visiblePadCenterYs: number[];
  padIntegrity: boolean[];
  stripBodyEvidence: 'clear_shared_body' | 'ambiguous' | 'none';
  values: Partial<Record<StripParameter, number>>;
  padReadings?: ModelPadReading[];
  confidence: number;
  notes: string;
  provider: AiProviderName;
  model: string;
}

interface ModelPadReading {
  parameter: 'totalChlorine' | 'freeChlorine' | 'ph' | 'alkalinity';
  selectedIndex: number;
  alternativeIndex: number;
  certainty: 'clear' | 'adjacent' | 'unreadable';
  focus: 'clear' | 'soft' | 'blurred';
  observedColor: string;
}
const PRO_PAD_METRICS: ModelPadReading['parameter'][] = ['totalChlorine', 'freeChlorine', 'ph', 'alkalinity'];

interface GeminiTokenUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  cachedContentTokenCount: number;
  totalTokenCount: number;
}

interface GeminiTokenUsageSummary extends GeminiTokenUsage {
  measuredRuns: number;
  runs: GeminiTokenUsage[];
}

type AiRunResponse =
  | { ok: true; data: AiRunData; usage?: GeminiTokenUsage }
  | { ok: false; error: string; message?: string; provider?: AiProviderName; usage?: GeminiTokenUsage };

interface AiProviderConfig {
  name: AiProviderName;
  apiKey: string;
  model: string;
}

interface CvResult {
  values: Partial<Record<StripParameter, number>>;
  confidence: number;
  notes?: string;
  evidence?: ColorAnalysisEvidence;
}

interface ColorRef {
  value: number;
  rgb: Rgb;
}

interface DecodedImage {
  width: number;
  height: number;
  getPixelAt: (x: number, y: number) => number;
  clone?: () => DecodedImage;
  rotate?: (angle: number, resize?: boolean) => DecodedImage;
}

interface NormalizedPadBox {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

const SCAN_IMAGES_BUCKET = 'scan-images';
const GEMINI_DEFAULT_MODEL = 'gemini-3.5-flash';
const ANALYSIS_VERSION = 'aquachek-pro-v30-source-photo-crops';
const MIN_ACCEPTED_CV_CONFIDENCE = 0.32;
// Retained focus thresholds are heuristics; they do not establish accuracy
// across phone models, lighting conditions or strip lots.
const MIN_AQUACHEK_SHARPNESS_VARIANCE = 4;
const HARD_MIN_AQUACHEK_SHARPNESS_VARIANCE = 0.5;

class EdgeAnalysisError extends Error {
  code: 'unavailable' | 'invalid_strip';

  constructor(code: 'unavailable' | 'invalid_strip', message: string) {
    super(message);
    this.code = code;
    this.name = 'EdgeAnalysisError';
  }
}

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

const PARAM_KEYS: StripParameter[] = [
  'freeChlorine',
  'totalChlorine',
  'bromine',
  'ph',
  'alkalinity',
  'cyanuricAcid',
  'hardness',
  'salt',
];

const PARAM_META: Record<StripParameter, { name: string; unit: string; min: number; max: number }> = {
  freeChlorine: { name: 'כלור חופשי', unit: 'ppm', min: 1, max: 3 },
  totalChlorine: { name: 'כלור כולל', unit: 'ppm', min: 1, max: 3 },
  bromine: { name: 'ברום', unit: 'ppm', min: 2, max: 6 },
  ph: { name: 'pH', unit: '', min: 7.2, max: 7.6 },
  alkalinity: { name: 'אלקליניות', unit: 'ppm', min: 80, max: 120 },
  cyanuricAcid: { name: 'חומצה ציאנורית', unit: 'ppm', min: 30, max: 50 },
  hardness: { name: 'קשיות כללית', unit: 'ppm', min: 200, max: 400 },
  salt: { name: 'מלח', unit: 'ppm', min: 3000, max: 3500 },
};

const PARAM_HINTS: Record<StripParameter, string> = {
  freeChlorine: 'freeChlorine: ppm, typical 0-10',
  totalChlorine: 'totalChlorine: ppm, typical 0-10',
  bromine: 'bromine: ppm, typical 0-20',
  ph: 'ph: 6.2-8.4',
  alkalinity: 'alkalinity: ppm, typical 0-240',
  cyanuricAcid: 'cyanuricAcid: ppm (CYA / stabilizer), typical 0-150',
  hardness: 'hardness: ppm (total/calcium), typical 0-1000',
  salt: 'salt: ppm, typical 0-6000',
};

const STRIP_BRANDS: StripBrand[] = [
  {
    id: 'aquachek-pro-5in1',
    nameHe: 'AquaChek Pro (4 פדים, 5 מדידות)',
    parameters: ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'],
  },
  {
    id: 'aquachek-yellow-4',
    nameHe: 'AquaChek Yellow (4-in-1)',
    parameters: ['freeChlorine', 'ph', 'alkalinity', 'cyanuricAcid'],
  },
  {
    id: 'aquachek-silver-salt',
    nameHe: 'AquaChek Silver (4-in-1 + מלח)',
    parameters: ['freeChlorine', 'ph', 'alkalinity', 'salt'],
  },
  {
    id: 'aquachek-7',
    nameHe: 'AquaChek 7-in-1',
    parameters: ['hardness', 'totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  },
  {
    id: 'hth-6-way',
    nameHe: 'HTH 6-Way',
    parameters: ['totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  },
  {
    id: 'clorox-3in1',
    nameHe: 'Clorox 3-in-1',
    parameters: ['freeChlorine', 'ph', 'alkalinity'],
  },
];

const DEFAULT_BRAND_ID = 'aquachek-pro-5in1';

const YELLOW_REFS: Partial<Record<StripParameter, ColorRef[]>> = {
  freeChlorine: [
    { value: 0, rgb: [248, 245, 230] },
    { value: 1, rgb: [240, 205, 215] },
    { value: 3, rgb: [228, 150, 180] },
    { value: 5, rgb: [200, 95, 150] },
    { value: 10, rgb: [135, 40, 115] },
  ],
  ph: [
    { value: 6.2, rgb: [245, 225, 90] },
    { value: 6.8, rgb: [240, 180, 80] },
    { value: 7.2, rgb: [235, 135, 75] },
    { value: 7.8, rgb: [220, 90, 70] },
    { value: 8.4, rgb: [180, 55, 55] },
  ],
  alkalinity: [
    { value: 0, rgb: [235, 210, 80] },
    { value: 40, rgb: [190, 200, 90] },
    { value: 80, rgb: [140, 185, 100] },
    { value: 120, rgb: [100, 165, 100] },
    { value: 180, rgb: [50, 130, 90] },
    { value: 240, rgb: [35, 110, 120] },
  ],
  cyanuricAcid: [
    { value: 0, rgb: [240, 240, 235] },
    { value: 30, rgb: [220, 215, 200] },
    { value: 50, rgb: [195, 190, 180] },
    { value: 100, rgb: [165, 155, 140] },
    { value: 150, rgb: [120, 110, 100] },
  ],
};

const BUNDLED_PRO_CHART = parseProColorChart(bundledProChart)!;
const AQUACHEK_PRO_CHART = buildProChartPrompt(BUNDLED_PRO_CHART);

const AQUACHEK_YELLOW_CHART = `
OFFICIAL AquaChek Yellow 4-in-1 color chart (memorize and use this - do NOT
guess colors from generic strip knowledge). The strip has EXACTLY 4 pads in
this printed order from top to bottom:

Pad 1 - Free Chlorine (white -> pink -> magenta/purple, NOT yellow/green):
  FC 0    -> near-white                  (R248 G245 B230)
  FC 1    -> light pink                  (R240 G205 B215)
  FC 3    -> pink                        (R228 G150 B180)
  FC 5    -> magenta                     (R200 G95  B150)
  FC 10   -> dark purple/magenta         (R135 G40  B115)

Pad 2 - pH (yellow -> orange -> red):
  pH 6.2  -> bright yellow               (R245 G225 B90)
  pH 6.8  -> orange-yellow               (R240 G180 B80)
  pH 7.2  -> orange                      (R235 G135 B75)
  pH 7.8  -> red-orange                  (R220 G90  B70)
  pH 8.4  -> dark red                    (R180 G55  B55)

Pad 3 - Total Alkalinity (yellow-green -> green -> teal):
  TA 0    -> yellow                      (R235 G210 B80)
  TA 40   -> yellow-green                (R190 G200 B90)
  TA 80   -> light green                 (R140 G185 B100)
  TA 120  -> green                       (R100 G165 B100)
  TA 180  -> dark green                  (R50  G130 B90)
  TA 240  -> teal/blue-green             (R35  G110 B120)

Pad 4 - Cyanuric Acid (turbidity pad - white -> tan/gray, never bright):
  CYA 0   -> white                       (R240 G240 B235)
  CYA 30  -> very light tan              (R220 G215 B200)
  CYA 50  -> light gray-tan              (R195 G190 B180)
  CYA 100 -> tan-gray                    (R165 G155 B140)
  CYA 150 -> dark gray-brown             (R120 G110 B100)
`;

function getBrand(id?: string): StripBrand {
  return STRIP_BRANDS.find((brand) => brand.id === id) ?? STRIP_BRANDS[0];
}

function isAquachekPro(brand: StripBrand) {
  return brand.id === 'aquachek-pro-5in1';
}

function isAquachekYellow(brand: StripBrand) {
  return brand.id === 'aquachek-yellow-4';
}

function parameterStatus(value: number, min: number, max: number) {
  if (value < min) return { kind: 'low' as const, label: 'נמוך', tone: 'warning' as const };
  if (value > max) return { kind: 'high' as const, label: 'גבוה', tone: 'warning' as const };
  return { kind: 'ok' as const, label: 'תקין', tone: 'success' as const };
}

function parameterProgress(value: number, min: number, max: number) {
  const spread = max - min || 1;
  const low = min - spread;
  const high = max + spread;
  return Math.max(6, Math.min(96, Math.round(((value - low) / (high - low)) * 100)));
}

function buildParameter(
  key: StripParameter,
  rawValue: number,
  confidence?: number,
  evidence?: ParameterAnalysisEvidence,
): ScanResultParameter {
  const meta = PARAM_META[key];
  const value = Number(rawValue);
  const status = parameterStatus(value, meta.min, meta.max);

  return {
    key,
    name: meta.name,
    value,
    unit: meta.unit,
    idealRange: {
      min: meta.min,
      max: meta.max,
      label: `${meta.min} - ${meta.max}`,
    },
    status,
    recommendation:
      status.kind === 'ok'
        ? `${meta.name} בטווח תקין.`
        : `נדרש תיקון קל עבור ${meta.name}.`,
    progress: parameterProgress(value, meta.min, meta.max),
    confidence,
    evidence,
  };
}

function buildResult(
  request: AnalyzeStripRequest,
  brand: StripBrand,
  values: Partial<Record<StripParameter, number>>,
  source: AnalysisSource,
  confidence: number,
  options: {
    lowConfidence?: boolean;
    model?: string;
    notes?: string;
    provider?: AiProviderName;
    shotsUsed?: number;
    isValidStrip?: boolean;
    failureReason?: FailureReason;
    analysisVersion?: string;
    accepted?: boolean;
    acceptanceReasons?: string[];
    evidence?: AnalysisEvidence;
  } = {},
): StripAnalysisResult {
  const parameters = brand.parameters
    .map((parameter) => {
      const value = values[parameter];
      return typeof value === 'number' && !Number.isNaN(value)
        ? buildParameter(
            parameter,
            Number(value.toFixed(parameter === 'ph' ? 2 : 1)),
            confidence,
            options.evidence?.parameters[parameter],
          )
        : null;
    })
    .filter((parameter): parameter is ScanResultParameter => Boolean(parameter));
  const hasWarning = parameters.some((parameter) => parameter.status.tone === 'warning');
  const sourceLabel = source === 'ai' ? 'AI' : source === 'cv' ? 'CV' : 'mock';
  const lowConfidenceText = options.lowConfidence ? ' הביטחון נמוך, מומלץ לצלם שוב באור טבעי.' : '';

  return {
    id: request.testId,
    analyzedAt: Date.now(),
    brandId: brand.id,
    imageUri: request.imageUrl ?? request.imagePath ?? request.imageUri,
    imagePath: request.imagePath,
    imageUrl: request.imageUrl,
    poolId: request.poolId,
    source,
    provider: options.provider,
    model: options.model,
    confidence: Number(Math.max(0, Math.min(1, confidence)).toFixed(2)),
    analysisVersion: options.analysisVersion,
    accepted: options.accepted,
    acceptanceReasons: options.acceptanceReasons,
    evidence: options.evidence,
    lowConfidence: options.lowConfidence,
    isValidStrip: options.isValidStrip ?? true,
    failureReason: options.failureReason ?? 'none',
    notes: options.notes,
    shotsUsed: options.shotsUsed,
    overallStatus: {
      label: hasWarning ? 'נדרש תיקון קל' : 'המים מאוזנים',
      tone: hasWarning ? 'warning' : 'success',
    },
    parameters,
    recommendation: hasWarning
      ? `ניתוח ${sourceLabel} זיהה ערך אחד או יותר מחוץ לטווח.${lowConfidenceText}`
      : `ניתוח ${sourceLabel} מצא את הערכים בטווח תקין.${lowConfidenceText}`,
  };
}

function buildInvalidStripResult(
  request: AnalyzeStripRequest,
  brand: StripBrand,
  source: AnalysisSource,
  failureReason: FailureReason,
  note: string,
  options: {
    provider?: AiProviderName;
    model?: string;
    shotsUsed?: number;
    confidence?: number;
    analysisVersion?: string;
    acceptanceReasons?: string[];
    evidence?: AnalysisEvidence;
  } = {},
): StripAnalysisResult {
  return {
    id: request.testId,
    analyzedAt: Date.now(),
    brandId: brand.id,
    imageUri: request.imageUrl ?? request.imagePath ?? request.imageUri,
    imagePath: request.imagePath,
    imageUrl: request.imageUrl,
    poolId: request.poolId,
    source,
    provider: options.provider,
    model: options.model,
    confidence: Number(Math.max(0, Math.min(1, options.confidence ?? 0.12)).toFixed(2)),
    analysisVersion: options.analysisVersion ?? ANALYSIS_VERSION,
    accepted: false,
    acceptanceReasons: options.acceptanceReasons,
    evidence: options.evidence,
    lowConfidence: true,
    isValidStrip: false,
    failureReason,
    notes: note,
    shotsUsed: options.shotsUsed,
    overallStatus: {
      label: 'הסטיק שהוזן אינו תקין',
      tone: 'warning',
    },
    parameters: [],
    recommendation: note,
  };
}

function uniqueNonEmpty(values: Array<string | undefined | null>) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getPixelRgb(image: DecodedImage, x: number, y: number): Rgb {
  return readZeroBasedImageScriptRgb(
    image,
    (color: number) => ImageScript.colorToRGB(color),
    x,
    y,
  ) as Rgb;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function imageBytesToDataUrl(bytes: Uint8Array, mimeType: string) {
  const safeMimeType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  return `data:${safeMimeType};base64,${bytesToBase64(bytes)}`;
}

function sampleAverageRgb(image: DecodedImage, x: number, y: number, width: number, height: number): Rgb {
  const startX = clamp(Math.floor(x), 0, image.width - 1);
  const endX = clamp(Math.ceil(x + width), startX + 1, image.width);
  const startY = clamp(Math.floor(y), 0, image.height - 1);
  const endY = clamp(Math.ceil(y + height), startY + 1, image.height);
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      const [pr, pg, pb] = getPixelRgb(image, px, py);
      r += pr;
      g += pg;
      b += pb;
      count += 1;
    }
  }

  if (count === 0) throw new Error('No pixels sampled from pad region.');
  return [r / count, g / count, b / count];
}

function samplePads(
  image: DecodedImage,
  padCount: number,
  normalizedCenterYs?: number[],
  normalizedCenterX = 0.5,
  normalizedStripWidth?: number,
) {
  const regions = normalizedCenterYs?.length === padCount
    ? getLocalizedPadSampleRegions(
        image.width,
        image.height,
        normalizedCenterYs,
        normalizedCenterX,
        normalizedStripWidth,
      )
    : getFixedPadSampleRegions(image.width, image.height, padCount);
  return regions.map((region) =>
    sampleAverageRgb(image, region.x, region.y, region.width, region.height),
  );
}

function sampleRobustRgb(
  image: DecodedImage,
  x: number,
  y: number,
  width: number,
  height: number,
  preferChroma = false,
): Rgb {
  const startX = clamp(Math.floor(x), 0, image.width - 1);
  const endX = clamp(Math.ceil(x + width), startX + 1, image.width);
  const startY = clamp(Math.floor(y), 0, image.height - 1);
  const endY = clamp(Math.ceil(y + height), startY + 1, image.height);
  const samples: Rgb[] = [];

  for (let py = startY; py < endY; py += 1) {
    for (let px = startX; px < endX; px += 1) {
      samples.push(getPixelRgb(image, px, py));
    }
  }

  return robustRgbFromSamples(samples, { preferChroma });
}

function samplePadBoxes(image: DecodedImage, normalizedPadBoxes: NormalizedPadBox[]) {
  const regions = getPadBoxSampleRegions(image.width, image.height, normalizedPadBoxes);
  return regions.map((region, index) =>
    sampleRobustRgb(
      image,
      region.x,
      region.y,
      region.width,
      region.height,
      index >= 2,
    ),
  );
}

function analyzeAquachekCvCandidate(
  image: DecodedImage,
  normalizedPadBoxes?: NormalizedPadBox[],
  chart: ProColorChart = BUNDLED_PRO_CHART,
): CvResult {
  if (normalizedPadBoxes?.length !== 4) {
    throw new Error('AquaChek Pro requires four model-localized reagent pad boxes.');
  }

  const getRgb = (x: number, y: number) => getPixelRgb(image, x, y);
  const normalizedCenterYs = normalizedPadBoxes.map((box) => box.centerY);
  const geometryCenterYs = [...normalizedCenterYs].sort((left, right) => left - right);
  const modelCenterXs = normalizedPadBoxes.map((box) => box.centerX).sort((left, right) => left - right);
  const modelCenterX = modelCenterXs.length % 2 === 1
    ? modelCenterXs[Math.floor(modelCenterXs.length / 2)]
    : (modelCenterXs[modelCenterXs.length / 2 - 1] + modelCenterXs[modelCenterXs.length / 2]) / 2;
  const modelPadWidths = normalizedPadBoxes
    .map((box) => box.width * image.width)
    .sort((left, right) => left - right);
  const modelStripWidth = modelPadWidths.length % 2 === 1
    ? modelPadWidths[Math.floor(modelPadWidths.length / 2)]
    : (modelPadWidths[modelPadWidths.length / 2 - 1] + modelPadWidths[modelPadWidths.length / 2]) / 2;

  // Structure is diagnostic only. Four unambiguous bands may refine sampling
  // coordinates; neither this geometry nor sampled colors replace AI values.
  const horizontalLocalization = locateAquachekProStripCenterX(
    image.width,
    image.height,
    getRgb,
    geometryCenterYs,
  );
  const structure = analyzeAquachekProStructure(
    image.width,
    image.height,
    getRgb,
    modelCenterX * image.width,
    geometryCenterYs,
    modelStripWidth,
  );
  const alignedBoxes = alignPadColorBoxes(image.height, normalizedPadBoxes, [
    ...structure.colorBands,
    ...structure.ignoredColorBands,
  ]);
  const sampledBoxes = alignedBoxes ?? normalizedPadBoxes;
  const sampledCenterYs = sampledBoxes.map(box => box.centerY);
  const whiteReference = structure.carrierReference;
  const sharpness = measureAquachekProSharpness(
    image.width,
    image.height,
    getRgb,
    modelCenterX * image.width,
    modelStripWidth,
    [...sampledCenterYs].sort((left, right) => left - right),
  );
  const pads = samplePadBoxes(image, sampledBoxes);
  const analysis = analyzeAquachekProDiscretePadRgbs(pads, { whiteReference, refs: chart.parameters });
  return {
    values: analysis.values,
    confidence: analysis.confidence,
    notes: 'Localized reagent pads compared with the versioned application color reference; this is not a guarantee of chemical accuracy.',
    evidence: {
      imageWidth: image.width,
      imageHeight: image.height,
      confidence: analysis.confidence,
      distances: analysis.distances,
      margins: analysis.margins,
      padRgbs: pads,
      selectedValues: analysis.values,
      padCenterYs: sampledCenterYs,
      modelPadCenterYs: normalizedCenterYs,
      modelPadBoxes: normalizedPadBoxes,
      sampledPadBoxes: sampledBoxes,
      padLocalization: alignedBoxes ? 'structure-refined' : 'model-boxes',
      padColorIdentity: alignedBoxes ? 'structure-aligned' : 'unverified',
      localizationCandidates: [{
        confidence: analysis.confidence,
        padCenterYs: sampledCenterYs,
        padLocalization: alignedBoxes ? 'structure-refined' : 'model-boxes',
      }],
      whiteReference,
      sharpnessVariance: sharpness.variance,
      padFocus: measureAquachekPadFocus(image.width, image.height, getRgb, sampledBoxes),
      minimumSharpnessVariance: MIN_AQUACHEK_SHARPNESS_VARIANCE,
      hardMinimumSharpnessVariance: HARD_MIN_AQUACHEK_SHARPNESS_VARIANCE,
      structure,
      horizontalLocalization,
      deskewAngle: 0,
    },
  };
}

function isAcceptableAquachekCvCandidate(candidate: CvResult) {
  return evaluateAquachekReadability({
    hasUsablePadCenters: candidate.evidence?.modelPadBoxes?.length === 4,
    structure: candidate.evidence?.structure,
    sharpnessVariance: candidate.evidence?.sharpnessVariance,
    colorConfidence: candidate.confidence,
  }, {
    minimumSharpnessVariance: MIN_AQUACHEK_SHARPNESS_VARIANCE,
    hardMinimumSharpnessVariance: HARD_MIN_AQUACHEK_SHARPNESS_VARIANCE,
    minimumColorConfidence: MIN_ACCEPTED_CV_CONFIDENCE,
  }).passed;
}

function analyzeCv(image: DecodedImage, brand: StripBrand, normalizedPadBoxes?: NormalizedPadBox[]): CvResult | null {
  if (isAquachekPro(brand)) {
    return analyzeAquachekCvCandidate(image, normalizedPadBoxes);
  }

  if (isAquachekYellow(brand)) {
    const pads = samplePads(image, 4);
    const freeChlorine = bestMatch(pads[0], YELLOW_REFS.freeChlorine!);
    const ph = bestMatch(pads[1], YELLOW_REFS.ph!);
    const alkalinity = bestMatch(pads[2], YELLOW_REFS.alkalinity!);
    const cyanuricAcid = bestMatch(pads[3], YELLOW_REFS.cyanuricAcid!);
    return {
      values: {
        freeChlorine: Number(freeChlorine.value.toFixed(1)),
        ph: Number(ph.value.toFixed(1)),
        alkalinity: Math.round(alkalinity.value),
        cyanuricAcid: Math.round(cyanuricAcid.value),
      },
      confidence: confidenceFromDistances([freeChlorine.distance, ph.distance, alkalinity.distance, cyanuricAcid.distance]),
      notes: 'CV fallback used AquaChek Yellow fixed pad sampling and color-chart matching.',
    };
  }

  return null;
}

function isQualityPassedRun(
  run: Extract<AiRunResponse, { ok: true }>,
  expectedPhysicalPadCount: number,
  allowColorReadingUncertainty = false,
) {
  const acceptedFailureReason =
    run.data.failureReason === 'none' ||
    (allowColorReadingUncertainty && run.data.failureReason === 'low_confidence');

  return (
    run.data.isStrip === true &&
    acceptedFailureReason &&
    run.data.physicalPadCount === expectedPhysicalPadCount &&
    run.data.allPadsFullyVisible === true &&
    run.data.hasExactlyOneStrip === true &&
    run.data.hasSingleContinuousStripBody === true &&
    run.data.allPadsIntact === true &&
    run.data.padOrderMatchesSelectedBrand === true &&
    run.data.hasExtraPadLikeRegions === false &&
    run.data.visiblePadBoxes.length === expectedPhysicalPadCount &&
    run.data.visiblePadCenterYs.length === expectedPhysicalPadCount &&
    run.data.padIntegrity.length === expectedPhysicalPadCount &&
    run.data.padIntegrity.every(Boolean) &&
    run.data.stripBodyEvidence === 'clear_shared_body'
  );
}

function isUsableAquachekAiRun(run: Extract<AiRunResponse, { ok: true }>) {
  const requiredValues: StripParameter[] = [
    'totalChlorine',
    'freeChlorine',
    'ph',
    'alkalinity',
  ];

  return (
    run.data.isStrip === true &&
    ['none', 'low_confidence'].includes(run.data.failureReason) &&
    run.data.physicalPadCount === 4 &&
    run.data.allPadsFullyVisible === true &&
    run.data.allPadsIntact === true &&
    requiredValues.every((parameter) => Number.isFinite(run.data.values[parameter]))
  );
}

function hasUsablePadBoxes(
  run: Extract<AiRunResponse, { ok: true }>,
  padCount: number,
) {
  const boxes = run.data.visiblePadBoxes;
  const centers = boxes.map((box) => Number(box.centerY));
  if (
    boxes.length !== padCount ||
    centers.length !== padCount ||
    boxes.some((box) =>
      !Number.isFinite(box.centerX) ||
      !Number.isFinite(box.centerY) ||
      !Number.isFinite(box.width) ||
      !Number.isFinite(box.height) ||
      box.centerX <= 0 || box.centerX >= 1 ||
      box.centerY <= 0 || box.centerY >= 1 ||
      box.width <= 0.005 || box.width > 1 ||
      box.height <= 0.005 || box.height > 1
    )
  ) {
    return false;
  }

  const gaps = centers.slice(1).map((center, index) => center - centers[index]);
  return gaps.every((gap) => gap >= 0.025) && centers.at(-1)! - centers[0] <= 0.9;
}

function median(values: number[]) {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 1
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
}

function consensusPadBoxes(runs: AiRunResponse[], padCount: number): NormalizedPadBox[] | undefined {
  const candidates = runs
    .filter((run): run is Extract<AiRunResponse, { ok: true }> => run.ok)
    // Gemini supplies independent pad boxes. Local carrier, sharpness and
    // reference-color checks still make the final acceptance decision.
    .filter((run) => hasUsablePadBoxes(run, padCount))
    .map((run) => run.data.visiblePadBoxes)
    .filter((boxes) => boxes.length === padCount);
  if (candidates.length === 0) return undefined;

  return Array.from({ length: padCount }, (_, index) => ({
    centerX: median(candidates.map((boxes) => boxes[index].centerX)),
    centerY: median(candidates.map((boxes) => boxes[index].centerY)),
    width: median(candidates.map((boxes) => boxes[index].width)),
    height: median(candidates.map((boxes) => boxes[index].height)),
  }));
}

function getProReferenceImage(chart?: ProColorChart) {
  // Never attach a stale image when an operator has changed the DB reference.
  if (!chart || chart.revision !== bundledProReferenceImage.revision ||
    bundledProReferenceImage.sha256 !== bundledProChart.source.imageSha256 ||
    JSON.stringify(chart.parameters) !== JSON.stringify(BUNDLED_PRO_CHART.parameters)) return undefined;
  return { mimeType: bundledProReferenceImage.mimeType, data: bundledProReferenceImage.data };
}

function buildSystemPrompt(brand: StripBrand, chart: ProColorChart = BUNDLED_PRO_CHART) {
  const isPro = isAquachekPro(brand);
  if (isPro) {
    return `You are the primary visual reader of an AquaChek Pro 5-in-1 strip.
Assess ONLY the first image, which is the user's ordinary phone photograph.
${getProReferenceImage(chart) ? 'The second image is the supplied color-reference chart, not another strip. Use its corresponding rows to compare the first image.' : 'Use the versioned text reference below.'}
The pixel sampler is diagnostic and is not calibrated for phone exposure or pad-box error.
A valid image has one continuous neutral strip carrier with four complete reagent pads.
Return isStrip=false for unrelated scenes, wrong strip models, missing/covered/torn pads,
or blur/glare/lighting that prevents representative pad color from being read.
Accept ordinary phone-photo conditions: a hand, background, tilt, JPEG compression,
wet texture, mild softness, shadows or exposure variation when representative pad colors
and all four pads remain readable. Do not demand studio lighting or exact reference RGBs.
Never infer a hidden pad or fill an uncertain reading with a normal value.

Identify wet tip and handle from physical geometry. The long blank carrier is the handle.
Provide best-effort visiblePadBoxes around reagent material in wet-tip-to-handle
order (TC/bromine, FC, pH, alkalinity), normalized to the image. Preserve this physical
order even if the strip is upside down. Avoid white gaps and background. Pad boxes are
diagnostic; uncertainty about their exact coordinates alone must not reject a readable strip.
Normalize coordinates against the ENTIRE first photograph, not the reference image or
an imagined tight crop. Locate each visible reagent region separately; do not invent
a regularly spaced coordinate template. The last box belongs on the fourth colored
reagent pad before the long blank handle, not on the preceding pH pad.
Report physicalPadCount from directly visible pads, independent of the boxes.
Structural flags and padIntegrity are required. If the pad identity, physical continuity
or a listed color level is actually unclear, report low_confidence instead of guessing.
Read representative pad colors. Return a listed level without interpolation.
Total chlorine and bromine share one pad and the same color-level index.

Read each physical pad independently BEFORE choosing numerical values:
- In padReadings, describe its dominant visible color in observedColor, ignoring
  white wet highlights, carrier edges, background and deep edge shadows.
- Compare that observation directly with the corresponding ROW of the supplied
  chart. Compare hue first, then saturation and lightness. Do not substitute a
  remembered generic chart, expected healthy chemistry or a familiar normal value.
- selectedIndex is the ZERO-BASED column of the closest swatch in that row.
  Set values from that exact chart column. TC and bromine use the same column.
- Compare the closest swatch with its nearest plausible neighbor. If both remain
  plausible, use certainty="adjacent" and give that neighbor in alternativeIndex.
  If the closest swatch is distinguishable, use certainty="clear" and set
  alternativeIndex=selectedIndex. A global confidence score cannot erase a
  per-pad ambiguity. Adjacent-level ambiguity alone does not invalidate a readable
  strip; retain its closest estimate and report the uncertainty for that pad.
- focus describes image softness; it does not decide acceptance on its own.
  An ordinary phone photo may be soft or blurred yet show representative reagent
  colors clearly enough for a chart comparison. Accept it when all four complete
  pads can be identified and their closest chart levels can reasonably be read.
  Do not require sharp pad texture, crisp edges or a high-quality camera.
  Use adjacent alternatives for uncertain neighbouring levels. Only report
  failureReason="blurry" when defocus actually prevents representative color
  from being read, not merely because pad details or edges are soft.
- If representative color cannot be read at all, use certainty="unreadable" and
  failureReason="low_confidence" (or lighting/blurry when that is the cause).
  Never hide uncertainty by outputting zero or a healthy value.

${buildProChartPrompt(chart)}
Return the JSON schema with a short Hebrew note. Confidence is an uncertainty score,
not a proven percentage of chemical accuracy.`;
  }
  const isYellow =
    brand.parameters.length === 4 &&
    brand.parameters.includes('freeChlorine') &&
    brand.parameters.includes('ph') &&
    brand.parameters.includes('alkalinity') &&
    brand.parameters.includes('cyanuricAcid');
  const padList = isPro
    ? [
        "Pad 1 (closest to wet tip): combined Total Chlorine + Total Bromine - report BOTH values from this single pad's color.",
        'Pad 2: Free Chlorine.',
        'Pad 3: pH.',
        'Pad 4 (closest to handle / dry end): Total Alkalinity.',
      ].join('\n')
    : brand.parameters.map((parameter, index) => `${index + 1}. ${parameter} - ${PARAM_HINTS[parameter]}`).join('\n');

  const expectedPhysicalPadCount = isPro ? 4 : brand.parameters.length;

  return `You are an expert pool/spa water test strip analyzer.
The user is using this strip brand: "${brand.nameHe}".
${isPro
  ? `This strip has EXACTLY 4 PHYSICAL PADS but yields 5 measurements (TC and TB share pad 1). Pad order from the wet tip toward the handle:\n${padList}`
  : `This strip has EXACTLY these pads, in this printed order from top to bottom:\n${padList}`}

FIRST determine if the image actually shows a pool/spa test strip (a thin plastic strip with multiple colored pads).
If NOT, set isStrip=false, confidence=0, all values=0, and put a short Hebrew note.
If the image shows a different strip type/brand/model than "${brand.nameHe}", classify it as unsupported_strip.
The app intentionally sends a very tight crop. A valid crop can have a flat or artificial-looking background, clean rectangular edges, uniform colors, or no hand/container visible. Never reject it merely as a "graphic", "illustration", "render", or "representation". Decide from the visible strip geometry only.

Before reading any values, count the separate PHYSICAL REAGENT PADS that are actually visible in the image:
- Count only real reagent pads attached to the plastic strip.
- Do NOT count white gaps, the plastic handle, shadows, glare, printed marks, or stains as pads.
- Do NOT infer or reconstruct a hidden, removed, cropped, or missing pad from the expected strip layout.
- Set physicalPadCount to the number you can directly see and set allPadsFullyVisible=true only when every pad is completely visible and none is cropped.
- This selected strip must show exactly ${expectedPhysicalPadCount} complete physical pads. If the count is different, or any pad is only partly visible, set failureReason="framing", isStrip=false, confidence=0, and all values=0.
- A strip with only 3 visible pads is INVALID even when the remaining colors are sharp and readable. Never estimate the missing measurement.
- Scan the entire primary strip from wet tip to handle before deciding the count. Do not stop after finding the expected four pads.
- For EVERY distinct colored reagent pad on the primary body, return one tight bounding box in visiblePadBoxes. Each box contains centerX, centerY, width and height normalized from 0.0 to 1.0 relative to the full image.
- Bound the colored reagent material itself, not the white carrier, shadows, gaps, background, or the entire strip. Include the complete reagent pad with only a tiny margin.
- Locate every pad independently. A tilted or perspective-distorted strip may give each pad a different centerX, width, and height. Never force the pads onto one shared vertical line.
- Sort visiblePadBoxes by centerY from the wet tip toward the handle. Two colored regions separated by a visible neutral stripe are two candidates, even when they are unusually close together.
- physicalPadCount MUST equal visiblePadBoxes.length. An extra fifth candidate cannot be ignored merely because four expected sample positions are also visible.

Then complete this STRUCTURAL CHECKLIST independently of the pad count:
- Judge structure from the PRIMARY STRIP CANDIDATE only: the long narrow neutral-colored body carrying the reagent pads. The body can be hidden underneath each pad; visible side margins, gaps, and/or handle sections are sufficient evidence that the pads share one body. Ignore unrelated background objects, isolated colored rectangles, shadows, glare, surface texture, printed marks, and image borders.
- hasExactlyOneStrip=false only when a second object is itself recognizably a test strip: it must have its own long narrow body with one or more attached reagent pads. A colored object, chart swatch, reflection, shadow, or strip-shaped background edge is NOT a second strip.
- hasSingleContinuousStripBody=false only when the pads truly float independently with no shared neutral body/margins at all, or the primary body is physically separated or cut through. The body being hidden beneath reagent pads is normal. Uneven illumination, shadows, highlights, perspective, printed marks, pad gaps, clean synthetic-looking edges, and a handle extending outside the tight crop do NOT break body continuity.
- allPadsIntact=false only for a clear physical defect: a reagent pad is cropped by the image boundary, covered by a finger/object, torn, divided into separate pieces, or has a foreign opaque stripe cutting through it. Natural pad texture, mottling, noise, wet gradients, glare, shadows, and minor edge softness do NOT make a pad non-intact.
- Return padIntegrity with one boolean for every item in visiblePadBoxes, in the same order. A pad split by a neutral/opaque stripe, visibly occluded, or cropped is false. padIntegrity.length MUST equal visiblePadBoxes.length and allPadsIntact MUST equal padIntegrity.every(Boolean).
- padOrderMatchesSelectedBrand=false only when there is clear visual evidence that complete pads were geometrically permuted, or the visible strip architecture belongs to another brand. Unusual water chemistry, pale/strong valid colors, lighting, texture, or uncertainty about a color value are NOT evidence of swapped order. When structure matches but a color is ambiguous, keep this true and use low_confidence instead.
- hasExtraPadLikeRegions=true only when an additional reagent pad is visibly attached to and aligned on the SAME primary strip body. An isolated colored object, background decoration, reflection, shadow, stain, or chart swatch outside that body is never an extra pad.
- Set stripBodyEvidence="clear_shared_body" when a neutral plastic carrier is visibly shared by all candidates: look for continuous side margins, neutral gaps between candidates, and/or a neutral handle extending beyond them. Set it to "none" when colored rectangles merely float in a vertical column on the background without shared plastic. Use "ambiguous" when a real narrow carrier is visible but glare, a tight crop, pale pads, or background similarity prevents certainty. Ambiguous body evidence is acceptable when exactly four complete pads remain visible on one candidate strip; the server performs an independent structure check.
- If hasExactlyOneStrip=false or hasSingleContinuousStripBody=false, set isStrip=false and failureReason="not_strip" (or "framing" for two strips).
- If allPadsIntact=false or hasExtraPadLikeRegions=true, set isStrip=false and failureReason="framing".
- If padOrderMatchesSelectedBrand=false, set isStrip=false and failureReason="unsupported_strip".
- Never accept unrelated floating colored rectangles merely because four colors can be sampled. For a real single strip with exactly four complete pads, minor uncertainty in framing, body continuity, focus, or color should be reported accurately rather than forcing isStrip=false; the server performs independent structure, sharpness, and color checks.

Classify failureReason as one of:
- "none": clear, usable strip
- "not_strip": no test strip visible
- "blurry": strip visible but out of focus
- "lighting": bad lighting / glare / strong color cast
- "framing": strip cut off, too far, or some pads not visible
- "unsupported_strip": a real strip is visible but it does not match the selected/supported brand
- "low_confidence": strip readable but you are unsure of values

For not_strip / blurry / lighting / framing / unsupported_strip -> isStrip=false.
For low_confidence -> isStrip=true, confidence < 0.4.
Always provide a short, actionable Hebrew tip in notes.

If the strip IS readable, read each pad above by comparing its color to the
manufacturer chart for that brand. Critical rules:
- Read pads in the EXACT printed order listed above. Do not reorder by your
  own assumptions about which color "should" be which parameter.
- Return exactly one of the printed manufacturer levels for each pad. Never
  interpolate and never invent an intermediate value.
- Do not apply a guessed white-balance correction. If lighting, glare, or a
  color cast makes the nearest printed level uncertain, return low_confidence.
${isPro ? buildProChartPrompt(chart) : ''}${isYellow ? AQUACHEK_YELLOW_CHART : ''}
Return only JSON that matches the provided response schema. Only include real
readings for the parameters listed above - leave the others as 0.`;
}

function getAiProviderConfig(): AiProviderConfig | null {
  const configuredProvider = Deno.env.get('STRIP_AI_PROVIDER') ?? 'gemini';
  if (configuredProvider !== 'gemini') return null;

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  if (geminiKey) {
    return {
      name: 'gemini',
      apiKey: geminiKey,
      model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
    };
  }

  return null;
}

function normalizeAiArgs(args: Record<string, unknown>, brand: StripBrand, provider: AiProviderConfig): AiRunResponse {
  const rawValues =
    args.values && typeof args.values === 'object' && !Array.isArray(args.values)
      ? (args.values as Record<string, unknown>)
      : args;
  const values: Partial<Record<StripParameter, number>> = {};
  for (const parameter of brand.parameters) {
    const rawValue = rawValues[parameter];
    if (typeof rawValue === 'number') {
      values[parameter] = Number(rawValue);
    }
  }

  const padReadings: ModelPadReading[] = [];
  if (isAquachekPro(brand) && Array.isArray(args.padReadings)) {
    for (const item of args.padReadings) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const reading = item as Record<string, unknown>;
      if (!PRO_PAD_METRICS.includes(reading.parameter as ModelPadReading['parameter']) ||
        !Number.isInteger(reading.selectedIndex) || !Number.isInteger(reading.alternativeIndex) ||
        !['clear', 'adjacent', 'unreadable'].includes(String(reading.certainty)) ||
        !['clear', 'soft', 'blurred'].includes(String(reading.focus)) ||
        typeof reading.observedColor !== 'string' || !reading.observedColor.trim()) continue;
      padReadings.push({ parameter: reading.parameter as ModelPadReading['parameter'],
        selectedIndex: reading.selectedIndex as number, alternativeIndex: reading.alternativeIndex as number,
        // A named neighbouring alternative is uncertainty even if the model
        // also says "clear". Downgrade that claim instead of rejecting a usable
        // photograph over inconsistent wording; invalid indexes still fail.
        certainty: reading.certainty === 'clear' && reading.alternativeIndex !== reading.selectedIndex
          ? 'adjacent' : reading.certainty as ModelPadReading['certainty'], focus: reading.focus as ModelPadReading['focus'],
        observedColor: reading.observedColor.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 160) });
    }
  }

  const reportedPadCount = args.physicalPadCount;
  const physicalPadCount = typeof reportedPadCount === 'number' && Number.isInteger(reportedPadCount)
    ? Math.max(0, reportedPadCount) : 0;
  const allPadsFullyVisible = args.allPadsFullyVisible === true;
  const hasExactlyOneStrip = args.hasExactlyOneStrip === true;
  const hasSingleContinuousStripBody = args.hasSingleContinuousStripBody === true;
  const allPadsIntact = args.allPadsIntact === true;
  const padOrderMatchesSelectedBrand = args.padOrderMatchesSelectedBrand === true;
  const hasExtraPadLikeRegions = args.hasExtraPadLikeRegions !== false;
  const rawPadIntegrity = Array.isArray(args.padIntegrity) ? args.padIntegrity : [];
  const visiblePadEntries: Array<{ box: NormalizedPadBox; intact: boolean }> = [];
  if (Array.isArray(args.visiblePadBoxes)) {
    args.visiblePadBoxes.forEach((rawBox, index) => {
      if (!rawBox || typeof rawBox !== 'object' || Array.isArray(rawBox)) return;
      const boxRecord = rawBox as Record<string, unknown>;
      const box: NormalizedPadBox = {
        centerX: Number(boxRecord.centerX),
        centerY: Number(boxRecord.centerY),
        width: Number(boxRecord.width),
        height: Number(boxRecord.height),
      };
      if (
        !Number.isFinite(box.centerX) ||
        !Number.isFinite(box.centerY) ||
        !Number.isFinite(box.width) ||
        !Number.isFinite(box.height) ||
        box.centerX < 0 || box.centerX > 1 ||
        box.centerY < 0 || box.centerY > 1 ||
        box.width <= 0 || box.width > 1 ||
        box.height <= 0 || box.height > 1
      ) {
        return;
      }
      visiblePadEntries.push({ box, intact: rawPadIntegrity[index] === true });
    });
  }
  // Pro sampling uses the physical pad order, not the photograph's orientation.
  if (!isAquachekPro(brand)) {
    visiblePadEntries.sort((left, right) => left.box.centerY - right.box.centerY);
  }
  const visiblePadBoxes = visiblePadEntries.map((entry) => entry.box);
  const visiblePadCenterYs = visiblePadBoxes.map((box) => box.centerY);
  const padIntegrity = isAquachekPro(brand)
    ? rawPadIntegrity.map(value => value === true)
    : visiblePadEntries.map((entry) => entry.intact);
  const stripBodyEvidence = ['clear_shared_body', 'ambiguous', 'none'].includes(String(args.stripBodyEvidence))
    ? (args.stripBodyEvidence as AiRunData['stripBodyEvidence'])
    : 'none';
  const reportedFailureReason = (args.failureReason ?? 'none') as FailureReason;
  const modelIdentifiedStrip = args.isStrip === true;
  const failureReason = modelIdentifiedStrip
    ? reportedFailureReason
    : reportedFailureReason === 'none'
      ? 'not_strip'
      : reportedFailureReason;

  return {
    ok: true,
    data: {
      isStrip: modelIdentifiedStrip,
      failureReason,
      physicalPadCount,
      allPadsFullyVisible,
      hasExactlyOneStrip,
      hasSingleContinuousStripBody,
      allPadsIntact,
      padOrderMatchesSelectedBrand,
      hasExtraPadLikeRegions,
      visiblePadBoxes,
      visiblePadCenterYs,
      padIntegrity,
      stripBodyEvidence,
      values,
      padReadings: isAquachekPro(brand) ? padReadings : undefined,
      confidence: typeof args.confidence === 'number' && Number.isFinite(args.confidence) ? args.confidence : 0,
      notes: String(args.notes ?? ''),
      provider: provider.name,
      model: provider.model,
    },
  };
}

function dataUrlToGeminiInlineData(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL for Gemini inlineData.');
  }

  return {
    mimeType: match[1]?.startsWith('image/') ? match[1] : 'image/jpeg',
    data: match[2],
  };
}

function buildGeminiResponseSchema(brand: StripBrand) {
  const valueProperties: Record<string, { type: 'NUMBER' }> = {};
  for (const key of PARAM_KEYS) valueProperties[key] = { type: 'NUMBER' };

  const schema = {
    type: 'OBJECT',
    properties: {
      isStrip: { type: 'BOOLEAN' },
      failureReason: {
        type: 'STRING',
        enum: ['none', 'not_strip', 'blurry', 'lighting', 'framing', 'low_confidence', 'unsupported_strip'],
      },
      confidence: { type: 'NUMBER' },
      notes: { type: 'STRING' },
      physicalPadCount: { type: 'INTEGER' },
      allPadsFullyVisible: { type: 'BOOLEAN' },
      hasExactlyOneStrip: { type: 'BOOLEAN' },
      hasSingleContinuousStripBody: { type: 'BOOLEAN' },
      allPadsIntact: { type: 'BOOLEAN' },
      padOrderMatchesSelectedBrand: { type: 'BOOLEAN' },
      hasExtraPadLikeRegions: { type: 'BOOLEAN' },
      visiblePadBoxes: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            centerX: { type: 'NUMBER' },
            centerY: { type: 'NUMBER' },
            width: { type: 'NUMBER' },
            height: { type: 'NUMBER' },
          },
          required: ['centerX', 'centerY', 'width', 'height'],
        },
      },
      padIntegrity: {
        type: 'ARRAY',
        items: { type: 'BOOLEAN' },
      },
      stripBodyEvidence: {
        type: 'STRING',
        enum: ['clear_shared_body', 'ambiguous', 'none'],
      },
      values: {
        type: 'OBJECT',
        properties: valueProperties,
        required: PARAM_KEYS,
      },
    },
    required: [
      'isStrip',
      'failureReason',
      'confidence',
      'notes',
      'physicalPadCount',
      'allPadsFullyVisible',
      'hasExactlyOneStrip',
      'hasSingleContinuousStripBody',
      'allPadsIntact',
      'padOrderMatchesSelectedBrand',
      'hasExtraPadLikeRegions',
      'visiblePadBoxes',
      'padIntegrity',
      'stripBodyEvidence',
      'values',
    ],
  };
  if (!isAquachekPro(brand)) return schema;
  return { ...schema, properties: { ...schema.properties, padReadings: {
    type: 'ARRAY', items: { type: 'OBJECT', properties: {
      parameter: { type: 'STRING', enum: PRO_PAD_METRICS },
      selectedIndex: { type: 'INTEGER' }, alternativeIndex: { type: 'INTEGER' },
      certainty: { type: 'STRING', enum: ['clear', 'adjacent', 'unreadable'] },
      focus: { type: 'STRING', enum: ['clear', 'soft', 'blurred'] },
      observedColor: { type: 'STRING' },
    }, required: ['parameter', 'selectedIndex', 'alternativeIndex', 'certainty', 'focus', 'observedColor'] },
  } }, required: [...schema.required, 'padReadings'] };
}

function extractGeminiJson(json: Record<string, unknown>) {
  const candidates = json.candidates as Array<Record<string, unknown>> | undefined;
  const content = candidates?.[0]?.content as Record<string, unknown> | undefined;
  const parts = content?.parts as Array<Record<string, unknown>> | undefined;
  const text = parts?.map((part) => (typeof part.text === 'string' ? part.text : '')).join('').trim();
  if (!text) {
    throw new Error('Gemini returned no text content.');
  }

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as Record<string, unknown>;
}

function extractGeminiTokenUsage(json: Record<string, unknown>): GeminiTokenUsage | undefined {
  const usage = json.usageMetadata;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) return undefined;

  const metadata = usage as Record<string, unknown>;
  const tokenCount = (key: string) => {
    const value = Number(metadata[key] ?? 0);
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
  };

  return {
    promptTokenCount: tokenCount('promptTokenCount'),
    candidatesTokenCount: tokenCount('candidatesTokenCount'),
    thoughtsTokenCount: tokenCount('thoughtsTokenCount'),
    cachedContentTokenCount: tokenCount('cachedContentTokenCount'),
    totalTokenCount: tokenCount('totalTokenCount'),
  };
}

function summarizeGeminiTokenUsage(runs: AiRunResponse[]): GeminiTokenUsageSummary {
  const usages = runs.map((run) => run.usage).filter((usage): usage is GeminiTokenUsage => Boolean(usage));
  const sum = (key: keyof GeminiTokenUsage) => usages.reduce((total, usage) => total + usage[key], 0);

  return {
    measuredRuns: usages.length,
    promptTokenCount: sum('promptTokenCount'),
    candidatesTokenCount: sum('candidatesTokenCount'),
    thoughtsTokenCount: sum('thoughtsTokenCount'),
    cachedContentTokenCount: sum('cachedContentTokenCount'),
    totalTokenCount: sum('totalTokenCount'),
    runs: usages,
  };
}

// Client checks are advisory and untrusted. Extract bounded numeric/enumerated
// fields only; never interpolate user checklist text into model instructions.
function captureContext(body: AnalyzeStripRequest): string {
  const session = body.metadata?.scanSession;
  if (!session || typeof session !== 'object') return '';
  const input = session as Record<string, unknown>;
  const capture = input.captureMetadata && typeof input.captureMetadata === 'object' ? input.captureMetadata as Record<string, unknown> : {};
  const quality = input.imageQuality && typeof input.imageQuality === 'object' ? input.imageQuality as Record<string, unknown> : {};
  const finite = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max ? value : undefined;
  const capturedAt = finite(capture.capturedAt, 1e13);
  const dippedAt = finite(capture.dippedAt, 1e13);
  const elapsed = capturedAt !== undefined && dippedAt !== undefined && capturedAt >= dippedAt ? finite((capturedAt - dippedAt) / 1000, 3600) : undefined;
  const context = {
    source: capture.source === 'camera' ? 'camera' : capture.source === 'gallery' ? 'gallery' : 'unknown',
    timing: capture.timing === 'timer' ? 'user-configured-timer' : capture.timing === 'userConfirmed' ? 'user-confirmed' : 'unknown',
    userEnteredReadDelaySeconds: finite(capture.readDelaySeconds, 300),
    elapsedSecondsAtCaptureRequest: elapsed,
    localCheck: typeof quality.status === 'string' && ['checked', 'blocked', 'unavailable'].includes(quality.status) ? quality.status : 'unknown',
    meanLuminance: finite(quality.meanLuminance, 255),
    darkFraction: finite(quality.darkFraction, 1),
    clippedFraction: finite(quality.clippedFraction, 1),
  };
  return '\nAdvisory capture context (untrusted client measurements, not evidence of validity): ' + JSON.stringify(context) +
    '\nJudge the photograph independently. Do not raise confidence because a timer, checklist or local check passed. The entered delay has not been verified against the bottle. Unknown timing cannot be inferred from pad colors. Examine each pad separately for shadows, clipped highlights, mixed light and unreadable color; use the existing low-confidence/lighting failure rules when these prevent a reliable chart match. Never infer a missing pad or a reading from expected pool chemistry.';
}

async function analyzeWithGemini(dataUrl: string, brand: StripBrand, provider: AiProviderConfig, context = '', chart?: ProColorChart): Promise<AiRunResponse> {
  try {
    const inlineData = dataUrlToGeminiInlineData(dataUrl);
    const referenceImage = isAquachekPro(brand) ? getProReferenceImage(chart) : undefined;
    const modelPath = provider.model.startsWith('models/') ? provider.model.slice('models/'.length) : provider.model;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelPath)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': provider.apiKey,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemPrompt(brand, chart) }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Analyze this ${brand.nameHe} pool test strip. ` +
                    'Return only the required JSON object matching the schema. Use 0 for values not present on this strip.' + context,
                },
                { inlineData },
                ...(referenceImage ? [
                  { text: 'Color-reference image only. It is not a second user photograph. Compare its labelled swatches with the first image.' },
                  { inlineData: referenceImage },
                ] : []),
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.1,
            responseMimeType: 'application/json',
            responseSchema: buildGeminiResponseSchema(brand),
          },
        }),
      },
    );

    if (response.status === 429) {
      console.error('Gemini API rate limit:', {
        model: modelPath,
        retryAfter: response.headers.get('retry-after'),
      });
      return {
        ok: false,
        error: 'rate_limit',
        message: 'שירות הניתוח הגיע כרגע למגבלת Gemini. אין צורך לנסות שוב ברצף.',
        provider: 'gemini',
      };
    }
    if (!response.ok) {
      console.error('Gemini API error:', response.status);
      return { ok: false, error: 'gemini_error', message: `שגיאה (${response.status})`, provider: 'gemini' };
    }

    const json = (await response.json()) as Record<string, unknown>;
    const args = extractGeminiJson(json);
    return {
      ...normalizeAiArgs(args, brand, provider),
      usage: extractGeminiTokenUsage(json),
    };
  } catch (error) {
    return {
      ok: false,
      error: 'gemini_exception',
      message: error instanceof Error ? error.message : 'Unexpected AI provider error.',
      provider: 'gemini',
    };
  }
}

async function analyzeWithAiProvider(dataUrl: string, brand: StripBrand, context = '', chart?: ProColorChart): Promise<AiRunResponse> {
  const provider = getAiProviderConfig();
  if (!provider) {
    return { ok: false, error: 'missing_ai_key', message: 'AI provider is not configured.' };
  }

  return analyzeWithGemini(dataUrl, brand, provider, context, chart);
}

function safeFailureReason(reason: FailureReason): FailureReason {
  return ['not_strip', 'blurry', 'lighting', 'framing', 'unsupported_strip', 'low_confidence'].includes(reason)
    ? reason
    : 'low_confidence';
}

function buildSingleAiResult(
  run: Extract<AiRunResponse, { ok: true }>,
  request: AnalyzeStripRequest,
  brand: StripBrand,
): StripAnalysisResult {
  const { data } = run;
  const acceptedFailureReason = data.failureReason === 'none' && Number.isFinite(data.confidence) &&
    data.confidence >= 0.6 && data.confidence <= 1;

  if (!data.isStrip || !acceptedFailureReason) {
    return buildInvalidStripResult(
      request,
      brand,
      'ai',
      safeFailureReason(data.failureReason),
      data.notes || 'Gemini לא זיהה בתמונה סטיק בדיקה מתאים.',
      {
        provider: data.provider,
        model: data.model,
        shotsUsed: 1,
        confidence: data.confidence,
        analysisVersion: ANALYSIS_VERSION,
        acceptanceReasons: ['Gemini rejected the image as a readable test strip.'],
      },
    );
  }

  const missingParameters = brand.parameters.filter(
    (parameter) => !Number.isFinite(data.values[parameter]),
  );
  if (missingParameters.length > 0) {
    return buildInvalidStripResult(
      request,
      brand,
      'ai',
      'low_confidence',
      data.notes || 'Gemini לא החזיר את כל ערכי הבדיקה הנדרשים.',
      {
        provider: data.provider,
        model: data.model,
        shotsUsed: 1,
        confidence: data.confidence,
        analysisVersion: ANALYSIS_VERSION,
        acceptanceReasons: [`Missing parameters: ${missingParameters.join(', ')}`],
      },
    );
  }

  return buildResult(request, brand, data.values, 'ai', data.confidence, {
    provider: data.provider,
    model: data.model,
    shotsUsed: 1,
    isValidStrip: true,
    failureReason: data.failureReason,
    lowConfidence: data.failureReason === 'low_confidence',
    notes: data.notes,
    analysisVersion: ANALYSIS_VERSION,
    accepted: true,
    acceptanceReasons: ['Gemini identified and read the selected test strip in one analysis call.'],
  });
}

function encodeStoragePath(path: string) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function loadProColorChart(request: Request): Promise<ProColorChart> {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new EdgeAnalysisError('unavailable', 'תצורת השירות חסרה.');
  const response = await fetch(url + '/rest/v1/strip_brands?select=color_chart&id=eq.aquachek-pro-5in1', {
    headers: userHeaders(request), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new EdgeAnalysisError('unavailable', 'מקרא הצבעים אינו זמין כרגע. נסה שוב מאוחר יותר.');
  const rows = await response.json();
  const chart = parseProColorChart(Array.isArray(rows) ? rows[0]?.color_chart : undefined);
  if (!chart) throw new EdgeAnalysisError('unavailable', 'מקרא הצבעים דורש עדכון לפני ניתוח חדש.');
  if (chart.calibrationStatus === 'unverified') {
    throw new EdgeAnalysisError('unavailable', 'מקרא הצבעים של דגם הסטיק טרם אומת. ניתוח חדש יהיה זמין לאחר עדכון המקרא.');
  }
  return chart;
}

function buildPhonePhotoResult(
  run: Extract<AiRunResponse, { ok: true }>, body: AnalyzeStripRequest,
  brand: StripBrand, image: DecodedImage | undefined, chart: ProColorChart,
): StripAnalysisResult {
  const base = buildSingleAiResult(run, body, brand);
  const { data } = run;
  const auditEvidence: AnalysisEvidence = {
    method: 'model-chart-with-color-diagnostics', referenceRevision: chart.revision,
    referenceImageIncluded: Boolean(getProReferenceImage(chart)),
    calibrationStatus: chart.calibrationStatus, requiredRuns: 1, successfulRuns: 1,
    qualityPassedRuns: 0, confidencePassedRuns: base.accepted === true ? 1 : 0,
    runConfidences: [Number.isFinite(data.confidence) ? data.confidence : 0],
    expectedPhysicalPadCount: 4, detectedPhysicalPadCounts: [data.physicalPadCount],
    fullyVisiblePadRuns: data.allPadsFullyVisible ? 1 : 0,
    singleStripRuns: data.hasExactlyOneStrip ? 1 : 0,
    continuousBodyRuns: data.hasSingleContinuousStripBody ? 1 : 0,
    intactPadRuns: data.allPadsIntact ? 1 : 0,
    correctPadOrderRuns: data.padOrderMatchesSelectedBrand ? 1 : 0,
    noExtraPadRuns: data.hasExtraPadLikeRegions ? 0 : 1,
    requiredParameters: brand.parameters, parameters: {},
    padReadings: data.padReadings,
  };
  if (base.accepted !== true || base.lowConfidence) return { ...base, evidence: auditEvidence };
  const reject = (reason: FailureReason, note: string) => buildInvalidStripResult(body, brand, 'ai', reason, note, {
    provider: data.provider, model: data.model, shotsUsed: 1,
    confidence: Math.min(0.3, Number.isFinite(data.confidence) ? data.confidence : 0),
    analysisVersion: ANALYSIS_VERSION, acceptanceReasons: [note], evidence: auditEvidence,
  });
  const boxes = data.visiblePadBoxes;
  if (data.physicalPadCount !== 4 || !data.allPadsFullyVisible ||
    !data.allPadsIntact || !data.hasExactlyOneStrip || !data.hasSingleContinuousStripBody ||
    data.stripBodyEvidence !== 'clear_shared_body' ||
    !data.padOrderMatchesSelectedBrand || data.hasExtraPadLikeRegions ||
    data.padIntegrity.length !== 4 || data.padIntegrity.some(intact => !intact)) {
    return reject('framing', 'לא ניתן לקרוא בבירור ארבעה פדים שלמים. צלם מקרוב בלי להסתיר או לחתוך פד.');
  }
  const padReadings = data.padReadings ?? [];
  if (padReadings.length !== 4 || PRO_PAD_METRICS.some(key =>
    padReadings.filter(reading => reading.parameter === key).length !== 1)) {
    return reject('low_confidence', 'לא התקבלה השוואת צבע מלאה לכל הפדים. נסה צילום נוסף.');
  }
  if (padReadings.some(reading => reading.certainty === 'unreadable')) {
    return reject('low_confidence', 'צבע של אחד הפדים אינו קריא מספיק. צלם שוב בתאורה אחידה.');
  }
  if (padReadings.some(reading => {
    const levels = chart.parameters[reading.parameter];
    return reading.selectedIndex < 0 || reading.selectedIndex >= levels.length ||
      reading.alternativeIndex < 0 || reading.alternativeIndex >= levels.length ||
      levels[reading.selectedIndex]?.value !== data.values[reading.parameter] ||
      (reading.certainty === 'clear' && reading.alternativeIndex !== reading.selectedIndex) ||
      (reading.certainty === 'adjacent' && Math.abs(reading.alternativeIndex - reading.selectedIndex) !== 1);
  })) return reject('low_confidence', 'הקריאה אינה עקבית עם דרגות מקרא הצבעים. נסה צילום נוסף.');
  const indexes = PRO_METRICS.map(key => chart.parameters[key].findIndex(level => level.value === data.values[key]));
  for (const key of PRO_METRICS) {
    auditEvidence.parameters[key] = {
      chartValues: chart.parameters[key].map(level => level.value),
      rawValues: Number.isFinite(data.values[key]) ? [data.values[key]!] : [],
      snappedValues: [], agreementCount: 0, requiredAgreement: 1,
    };
  }
  if (indexes.some(index => index < 0) || indexes[0] !== indexes[1]) {
    return reject('low_confidence', 'הקריאה אינה תואמת למקרא של סוג הסטיק. צלם שוב בתאורה אחידה.');
  }
  const diagnosticWarnings: string[] = [];
  // Model boxes and reference JPEG colors are approximate phone-photo aids.
  // Their failure is not independent proof that a visually readable pad is bad.
  const boxesUsable = Boolean(image) && boxes.length === 4 && boxes.every(box =>
    box.centerX - box.width / 2 >= 0 && box.centerX + box.width / 2 <= 1 &&
    box.centerY - box.height / 2 >= 0 && box.centerY + box.height / 2 <= 1 &&
    box.width * (image?.width ?? 0) >= 4 && box.height * (image?.height ?? 0) >= 4) &&
    !boxes.some((box, i) => boxes.slice(i + 1).some(other =>
      Math.abs(box.centerX - other.centerX) < (box.width + other.width) / 2 &&
      Math.abs(box.centerY - other.centerY) < (box.height + other.height) / 2));
  let candidate: CvResult | undefined;
  if (boxesUsable && image) {
    try { candidate = analyzeAquachekCvCandidate(image, boxes, chart); }
    catch { diagnosticWarnings.push('pixel_comparison_unavailable'); }
  } else diagnosticWarnings.push(image ? 'approximate_pad_boxes' : 'pixel_sampling_not_run');
  const evidence = candidate?.evidence;
  auditEvidence.colorAnalysis = evidence;
  if (evidence && evidence.padColorIdentity !== 'structure-aligned') {
    diagnosticWarnings.push('pad_color_identity_unverified');
  }
  if (evidence?.padFocus?.severeDefocus) {
    // Ordinary phone softness must not override an otherwise readable model
    // result. Keep this uncalibrated focus heuristic as a diagnostic warning.
    diagnosticWarnings.push('low_pad_detail');
  }
  for (const reading of padReadings) {
    if (reading.focus === 'blurred') diagnosticWarnings.push(`soft_model_focus:${reading.parameter}`);
  }
  if (evidence) {
    if (!Number.isFinite(evidence.sharpnessVariance) ||
      evidence.sharpnessVariance! < MIN_AQUACHEK_SHARPNESS_VARIANCE)
      diagnosticWarnings.push('low_local_focus_score');
    if (!evidence.structure?.hasNeutralCarrier)
      diagnosticWarnings.push('local_carrier_uncertain');
  }
  const parameterEvidence: AnalysisEvidence['parameters'] = {};
  const parameters = base.parameters.map(parameter => {
    const key = parameter.key as typeof PRO_METRICS[number];
    const colorKey = key === 'bromine' ? 'totalChlorine' : key;
    const colorComparisonValue = candidate?.values[key];
    const distance = evidence?.distances[colorKey];
    const margin = evidence?.margins[colorKey];
    const modelReading = padReadings.find(reading => reading.parameter === colorKey)!;
    const padIndex = PRO_PAD_METRICS.indexOf(colorKey as ModelPadReading['parameter']);
    const localFocus = evidence?.padFocus?.pads[padIndex];
    const lowPadDetail = Boolean(localFocus && localFocus.gradientEnergy >=
      (evidence?.padFocus?.minimumGradientEnergy ?? 25) && localFocus.highFrequencyRatio <
      (evidence?.padFocus?.minimumHighFrequencyRatio ?? 0.35));
    const needsVerification = modelReading.certainty !== 'clear' || modelReading.focus === 'blurred' ||
      lowPadDetail || Boolean(evidence &&
      (!Number.isFinite(distance) || !Number.isFinite(margin) || distance! > 25 || margin! < 3 ||
        colorComparisonValue !== data.values[key]));
    if (needsVerification) diagnosticWarnings.push(`review_color:${key}`);
    parameterEvidence[key] = {
      chartValues: chart.parameters[key].map(level => level.value),
      rawValues: [data.values[key]!], snappedValues: [data.values[key]!],
      selectedValue: data.values[key], agreementCount: 1, requiredAgreement: 1,
      confidenceBasis: 'model-reported', colorComparisonValue,
      colorAgrees: colorComparisonValue === undefined ? undefined : colorComparisonValue === data.values[key],
      needsVerification, colorDistance: distance, colorMargin: margin,
      modelCertainty: modelReading.certainty,
      alternativeValue: chart.parameters[key][modelReading.alternativeIndex]?.value,
      observedColor: modelReading.observedColor,
      referenceRgb: chart.parameters[key].find(level => level.value === data.values[key])?.rgb,
    };
    return { ...parameter, value: data.values[key]!, confidence: data.confidence,
      evidence: parameterEvidence[key] };
  });
  return { ...base, parameters,
    acceptanceReasons: ['The model identified four complete pads and returned only listed chart levels; pixel sampling is diagnostic.'],
    evidence: { ...auditEvidence, qualityPassedRuns: 1, parameters: parameterEvidence, diagnosticWarnings },
    notes: 'הערכה מצילום לפי מקרא הצבעים. יש לאמת מדדים חריגים לפני טיפול.',
  };
}

async function fetchImageBytesFromStorage(path: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured in the Edge Function environment.');
  }

  const storageUrl = `${supabaseUrl}/storage/v1/object/${SCAN_IMAGES_BUCKET}/${encodeStoragePath(path)}`;
  const response = await fetch(storageUrl, {
    headers: userHeaders(request), redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`Storage image download failed (${response.status}).`);
  }

  const bytes = await readBoundedBytes(response.body, MAX_IMAGE_BYTES);
  return { bytes, mimeType: validateImage(bytes) };
}

function loadImageBytesFromDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new Error('Invalid image data URL.');
  }

  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return {
    bytes,
    mimeType: validateImage(bytes),
  };
}

async function loadImageBytes(body: AnalyzeStripRequest, request: Request) {
  if (body.imagePath) {
    return fetchImageBytesFromStorage(body.imagePath, request);
  }

  if (body.imageUri?.startsWith('data:image/')) {
    return loadImageBytesFromDataUrl(body.imageUri);
  }

  throw new Error('No imagePath, imageUrl, or image data URL was provided for remote analysis.');
}

function getServiceHeaders(request?: Request) {
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = serviceRoleKey
    ? `Bearer ${serviceRoleKey}`
    : request?.headers.get('Authorization') ?? request?.headers.get('authorization') ?? '';

  return {
    apikey: serviceRoleKey ?? supabaseAnonKey,
    Authorization: authorization,
    'Content-Type': 'application/json',
  };
}

async function createStripAnalysisImageKey(body: AnalyzeStripRequest) {
  const identity = JSON.stringify({
    accountId: body.accountId ?? null,
    brandId: body.brandId ?? null,
    imagePath: body.imagePath ?? null,
    imageUri: body.imageUri ?? null,
    imageUrl: body.imageUrl ?? null,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value: Uint8Array | string) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function createStripAnalysisContentKey(body: AnalyzeStripRequest, imageBytes: Uint8Array, chart?: ProColorChart) {
  const imageDigest = await sha256Hex(imageBytes);
  return sha256Hex(
    JSON.stringify({
      accountId: body.accountId ?? null,
      analysisVersion: ANALYSIS_VERSION,
      brandId: body.brandId ?? null,
      imageDigest,
      model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
      poolId: body.poolId ?? null,
      referenceRevision: chart?.revision ?? null,
      referenceParameters: chart?.parameters ?? null,
      referenceImageSha256: getProReferenceImage(chart) ? bundledProReferenceImage.sha256 : null,
    }),
  );
}

function remapAnalysisResult(result: StripAnalysisResult, body: AnalyzeStripRequest): StripAnalysisResult {
  return {
    ...result,
    id: body.testId,
    imagePath: body.imagePath ?? result.imagePath,
    imageUri: body.imageUri ?? result.imageUri,
    imageUrl: body.imageUrl ?? result.imageUrl,
    poolId: body.poolId ?? result.poolId,
  };
}

function storedAnalysisError(errorCode?: string | null, errorMessage?: string | null) {
  return new EdgeAnalysisError(
    errorCode === 'invalid_strip' ? 'invalid_strip' : 'unavailable',
    errorMessage || 'ניתוח התמונה הקודם לא הושלם. נסו שוב בעוד כמה רגעים.',
  );
}

async function claimStripAnalysisRequest(
  userId: string,
  body: AnalyzeStripRequest,
  imageKey: string,
  contentKey: string,
  request: Request,
): Promise<StripAnalysisClaim> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה רגעים.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/claim_strip_analysis_content`, {
    method: 'POST',
    headers: getServiceHeaders(request),
    body: JSON.stringify({
      p_account_id: body.accountId ?? null,
      p_content_key: contentKey,
      p_image_key: imageKey,
      p_test_id: body.testId,
      p_user_id: userId,
    }),
  });

  if (!response.ok) {
    console.error('Failed to claim strip analysis request', {
      status: response.status,
      testId: body.testId,
    });
    throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה רגעים.');
  }

  const claim = (await response.json()) as StripAnalysisClaim;
  if (!claim || typeof claim.claimed !== 'boolean' || typeof claim.status !== 'string') {
    throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה רגעים.');
  }

  return claim;
}

async function beginGeminiProviderCall(
  userId: string,
  testId: string,
  imageKey: string,
  request: Request,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/begin_strip_analysis_provider_call`, {
    method: 'POST',
    headers: getServiceHeaders(request),
    body: JSON.stringify({
      p_image_key: imageKey,
      p_test_id: testId,
      p_user_id: userId,
    }),
  });

  if (!response.ok) {
    console.error('Failed to reserve Gemini provider call', {
      status: response.status,
      testId,
    });
    const failure = await response.json().catch(() => ({})) as { message?: string };
    throw new EdgeAnalysisError('unavailable', failure.message === 'scan_quota_exhausted'
      ? 'מכסת הסריקות נוצלה. אפשר לצפות בבדיקות הקיימות.'
      : failure.message === 'scan_rate_limited' ? 'בוצעו כמה בקשות ברצף. המתן דקה לפני בקשה חדשה.'
        : 'שירות הניתוח אינו זמין כרגע. נסה שוב בעוד כמה רגעים.');
  }

  return Boolean(await response.json());
}

async function waitForStripAnalysisResult(userId: string, testId: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה רגעים.');
  }

  const deadline = Date.now() + 55_000;
  const query = new URLSearchParams({
    select: 'status,result,error_code,error_message',
    user_id: `eq.${userId}`,
    test_id: `eq.${testId}`,
    limit: '1',
  });

  while (Date.now() < deadline) {
    const response = await fetch(`${supabaseUrl}/rest/v1/strip_analysis_requests?${query.toString()}`, {
      headers: getServiceHeaders(request),
    });

    if (!response.ok) {
      throw new EdgeAnalysisError('unavailable', 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה רגעים.');
    }

    const rows = (await response.json()) as StripAnalysisRequestRow[];
    const row = rows[0];
    if (row?.status === 'completed' && row.result) return row.result;
    if (row?.status === 'failed') throw storedAnalysisError(row.error_code, row.error_message);

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new EdgeAnalysisError('unavailable', 'הסריקה עדיין בעיבוד. המתינו רגע ונסו שוב.');
}

async function completeStripAnalysisRequest(
  userId: string,
  testId: string,
  result: StripAnalysisResult,
  request: Request,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('Missing SUPABASE_URL.');

  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    test_id: `eq.${testId}`,
    status: 'eq.processing',
  });
  const response = await fetch(`${supabaseUrl}/rest/v1/strip_analysis_requests?${query.toString()}`, {
    method: 'PATCH',
    headers: getServiceHeaders(request),
    body: JSON.stringify({
      error_code: null,
      error_message: null,
      lease_expires_at: new Date().toISOString(),
      provider_completed_at: new Date().toISOString(),
      result,
      status: 'completed',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) throw new Error(`Failed to complete strip analysis request (${response.status}).`);
}

async function failStripAnalysisRequest(
  userId: string,
  testId: string,
  error: unknown,
  request: Request,
  providerCallStarted: boolean,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return;

  const query = new URLSearchParams({
    user_id: `eq.${userId}`,
    test_id: `eq.${testId}`,
    status: 'eq.processing',
  });
  const errorCode = error instanceof EdgeAnalysisError ? error.code : 'unavailable';
  const errorMessage = error instanceof Error ? error.message : 'שירות הניתוח אינו זמין כרגע.';

  const response = await fetch(`${supabaseUrl}/rest/v1/strip_analysis_requests?${query.toString()}`, {
    method: 'PATCH',
    headers: getServiceHeaders(request),
    body: JSON.stringify({
      error_code: errorCode,
      error_message: errorMessage,
      lease_expires_at: new Date(Date.now() + 15_000).toISOString(),
      ...(providerCallStarted ? { provider_completed_at: new Date().toISOString() } : {}),
      status: 'failed',
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    console.error('Failed to record strip analysis failure', {
      status: response.status,
      testId,
    });
  }
}

async function getAuthenticatedUserId(request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const authorization = request.headers.get('Authorization') ?? request.headers.get('authorization');

  if (!supabaseUrl || !supabaseAnonKey || !authorization) return undefined;

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: authorization,
    },
  });

  if (!response.ok) return undefined;
  const user = await response.json();
  return typeof user.id === 'string' ? user.id : undefined;
}

async function verifyAccountMembership(accountId: string, userId: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return false;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/account_members?select=role&account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: getServiceHeaders(request),
    },
  );

  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length === 1 && ['owner', 'admin', 'editor'].includes(rows[0].role);
}

async function canCreateScan(accountId: string, userId: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return false;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/can_create_scan_for_user`, {
    method: 'POST',
    headers: getServiceHeaders(request),
    body: JSON.stringify({ p_account_id: accountId, p_user_id: userId }),
  });

  if (!response.ok) return false;
  return (await response.json()) === true;
}

async function persistAnalysisResult(body: AnalyzeStripRequest, result: StripAnalysisResult, userId: string, request: Request) {
  result = protectAnalysisResponse(result);
  if (!body.accountId) return;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return;

  const headers = getServiceHeaders(request);
  const testRow = {
    account_id: body.accountId,
    analyzed_at: new Date(result.analyzedAt).toISOString(),
    analysis_status: 'completed',
    confidence: result.confidence,
    error_message: result.lowConfidence ? result.notes ?? null : null,
    id: body.testId,
    image_path: result.imagePath ?? body.imagePath ?? null,
    image_url: result.imageUrl ?? body.imageUrl ?? null,
    is_billable: result.accepted !== false && result.isValidStrip !== false && !result.lowConfidence
      && (!result.failureReason || result.failureReason === 'none'),
    low_confidence: result.lowConfidence ?? false,
    model: result.model ?? null,
    overall_status: result.overallStatus.label,
    pool_id: body.poolId ?? null,
    provider: result.provider ?? null,
    raw_result: result,
    recommendation: result.recommendation,
    source: result.source,
    strip_brand_id: result.brandId ?? body.brandId ?? null,
    user_id: userId,
  };

  const testResponse = await fetch(`${supabaseUrl}/rest/v1/tests?on_conflict=id`, {
    method: 'POST',
    headers: {
      ...headers,
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify([testRow]),
  });
  if (!testResponse.ok) throw new Error(`Failed to persist test (${testResponse.status}).`);

  const readingRows = result.parameters.map((parameter) => ({
    account_id: body.accountId,
    confidence: parameter.confidence ?? result.confidence,
    label: parameter.name,
    max_value: parameter.idealRange.max,
    min_value: parameter.idealRange.min,
    parameter_key: parameter.key,
    raw: parameter,
    status: parameter.status.kind,
    test_id: body.testId,
    unit: parameter.unit,
    value: parameter.value,
  }));

  if (readingRows.length) {
    const readingsResponse = await fetch(`${supabaseUrl}/rest/v1/test_readings?on_conflict=test_id,parameter_key`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(readingRows),
    });
    if (!readingsResponse.ok) throw new Error('Failed to persist readings.');
  }

  const deleteResponse = await fetch(`${supabaseUrl}/rest/v1/test_recommendations?test_id=eq.${encodeURIComponent(body.testId)}`, {
    method: 'DELETE',
    headers,
  });
  if (!deleteResponse.ok) throw new Error('Failed to replace recommendations.');
  const recommendationsResponse = await fetch(`${supabaseUrl}/rest/v1/test_recommendations`, {
    method: 'POST',
    headers,
    body: JSON.stringify([
      {
        account_id: body.accountId,
        action_type: result.overallStatus.tone,
        description: result.recommendation,
        priority: 0,
        raw: result,
        test_id: body.testId,
        title: 'המלצה',
      },
    ]),
  });
  if (!recommendationsResponse.ok) throw new Error('Failed to persist recommendations.');

  // The RPC derives billability from the protected completion record and is
  // idempotent for this canonical scan, including after partial save failures.
  {
    const usageResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/register_scan_usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_account_id: body.accountId,
        p_test_id: body.testId,
        p_user_id: userId,
      }),
    });
    if (!usageResponse.ok) throw new Error('Failed to record scan usage.');
  }
}

async function analyzeRemoteWebParity(body: AnalyzeStripRequest, request: Request): Promise<StripAnalysisResult> {
  const brand = getBrand(body.brandId);
  let imageBytes: Uint8Array;
  let mimeType = 'image/jpeg';
  let dataUrl: string;
  const authenticatedUserId = await getAuthenticatedUserId(request);

  if (!authenticatedUserId) {
    throw new EdgeAnalysisError('unavailable', 'נדרשת התחברות כדי לבצע ניתוח AI.');
  }
  try {
    await requireAnalysisConsent(request);
  } catch {
    throw new EdgeAnalysisError('unavailable', 'ניתוח חדש דורש הסכמה מעודכנת לניתוח AI ואישור תצורת השירות. אפשר לעיין בתנאים ובפרטיות בהגדרות.');
  }
  if (!body.accountId || !UUID_PATTERN.test(body.accountId) ||
      !UUID_PATTERN.test(body.testId) || (body.poolId && !UUID_PATTERN.test(body.poolId))) {
    throw new EdgeAnalysisError('unavailable', 'פרטי החשבון או הבדיקה אינם תקינים.');
  }
  if (body.userId && body.userId !== authenticatedUserId) {
    throw new EdgeAnalysisError('unavailable', 'פרטי המשתמש אינם תואמים לחשבון המחובר.');
  }
  if (body.imageUrl || (!body.imagePath && body.imageUri && !body.imageUri.startsWith('data:image/'))) {
    throw new EdgeAnalysisError('invalid_strip', 'כתובת תמונה חיצונית אינה נתמכת. צלם או העלה תמונה חדשה.');
  }
  if (body.imagePath) {
    const expected = new RegExp('^accounts/' + body.accountId + '/users/' + authenticatedUserId +
      '/tests/' + body.testId + '/scan\\.(jpg|png)$');
    if (!expected.test(body.imagePath)) {
      throw new EdgeAnalysisError('invalid_strip', 'נתיב התמונה אינו תואם למשתמש ולבדיקה.');
    }
  }

  if (body.accountId) {
    const isMember = await verifyAccountMembership(body.accountId, authenticatedUserId, request);
    if (!isMember) {
      throw new EdgeAnalysisError('unavailable', 'המשתמש אינו משויך לחשבון שנשלח לניתוח.');
    }
  }
  await verifyAnalysisTargets(body, authenticatedUserId, request);

  try {
    const loaded = await loadImageBytes(body, request);
    imageBytes = loaded.bytes;
    mimeType = loaded.mimeType;
  } catch (error) {
    console.warn('remote image download failed', error);
    throw new EdgeAnalysisError('unavailable', 'לא הצלחנו לטעון את תמונת הסטיק לניתוח. נסו שוב בעוד כמה דקות.');
  }

  // One immutable catalog snapshot also forms part of the cache identity.
  const colorChart = isAquachekPro(brand) ? await loadProColorChart(request) : undefined;
  const imageKey = await createStripAnalysisImageKey(body);
  const contentKey = await createStripAnalysisContentKey(body, imageBytes, colorChart);
  const claim = await claimStripAnalysisRequest(authenticatedUserId, body, imageKey, contentKey, request);
  const canonicalTestId = claim.canonicalTestId ?? body.testId;

  if (!claim.claimed) {
    if (claim.status === 'completed' && claim.result) {
      console.log('Returning cached Gemini strip analysis', {
        canonicalTestId,
        testId: body.testId,
      });
      await persistAnalysisResult({ ...body, testId: canonicalTestId, imagePath: claim.result.imagePath },
        claim.result, authenticatedUserId, request);
      return remapAnalysisResult(claim.result, body);
    }

    if (claim.status === 'processing') {
      console.log('Waiting for in-flight Gemini strip analysis', {
        canonicalTestId,
        testId: body.testId,
      });
      const result = await waitForStripAnalysisResult(authenticatedUserId, canonicalTestId, request);
      await persistAnalysisResult({ ...body, testId: canonicalTestId, imagePath: result.imagePath },
        result, authenticatedUserId, request);
      return remapAnalysisResult(result, body);
    }

    if (claim.status === 'failed') {
      throw storedAnalysisError(claim.errorCode, claim.errorMessage);
    }

    throw new EdgeAnalysisError(
      'unavailable',
      'פרטי הסריקה השתנו בזמן העיבוד. חזרו למסך הצילום ונסו שוב.',
    );
  }

  let providerCallStarted = false;

  try {
    if (body.accountId) {
      const quotaAvailable = await canCreateScan(body.accountId, authenticatedUserId, request);
      if (!quotaAvailable) {
        throw new EdgeAnalysisError('unavailable', 'מכסת הסריקות החודשית נוצלה. כרגע לא ניתן לבצע ניתוח נוסף.');
      }
    }

    dataUrl = imageBytesToDataUrl(imageBytes, mimeType);

    // Input has already passed the bounded 24MP/byte/header validation.
    // Decode only safe smaller images for optional diagnostics, not as a camera requirement.
    let decodedImage: DecodedImage | undefined;
    if (colorChart) {
      let samplingSizeAllowed = true;
      try { validateImage(imageBytes, 4_000_000); }
      catch { samplingSizeAllowed = false; }
      if (samplingSizeAllowed) {
        try { decodedImage = await ImageScript.decode(imageBytes); }
        catch { throw new EdgeAnalysisError('invalid_strip', 'התמונה אינה ניתנת לקריאה. צלם שוב.'); }
        if (!decodedImage || decodedImage.width < 24 || decodedImage.height < 48 ||
          decodedImage.width * decodedImage.height > 4_000_000) {
          throw new EdgeAnalysisError('invalid_strip', 'גודל התמונה אינו מתאים לקריאת הסטיק. צלם מחדש באפליקציה.');
        }
      }
    }

    const providerCallReserved = await beginGeminiProviderCall(
      authenticatedUserId,
      canonicalTestId,
      imageKey,
      request,
    );
    if (!providerCallReserved) {
      console.warn('Gemini provider call already reserved; waiting for stored result', {
        testId: body.testId,
      });
      const result = await waitForStripAnalysisResult(authenticatedUserId, canonicalTestId, request);
      return remapAnalysisResult(result, body);
    }
    providerCallStarted = true;

    console.log('Starting Gemini strip analysis', {
      brandId: brand.id,
      model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
      testId: body.testId,
    });

    // Recheck after queue/claim waits, immediately before external transfer.
    await requireAnalysisConsent(request);
    const aiRun = await analyzeWithAiProvider(dataUrl, brand, captureContext(body), colorChart);
    const tokenUsage = summarizeGeminiTokenUsage([aiRun]);
    console.log('Gemini token usage for scan', {
      aiCallCount: 1,
      model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
      testId: body.testId,
      ...tokenUsage,
    });
    if (aiRun.ok) {
      const aiResult = colorChart
        ? buildPhonePhotoResult(aiRun, body, brand, decodedImage, colorChart)
        : buildSingleAiResult(aiRun, body, brand);
      const result = protectAnalysisResponse({ ...aiResult, tokenUsage });
      console.log('Gemini strip analysis selected', {
        accepted: aiResult.accepted,
        acceptanceReasons: aiResult.acceptanceReasons,
        analysisVersion: aiResult.analysisVersion,
        confidence: aiResult.confidence,
        evidence: aiResult.evidence,
        failureReason: aiResult.failureReason,
        model: aiResult.model,
        source: aiResult.source,
        testId: body.testId,
      });
      // Store the provider result first so a failed history save can be retried
      // from the cache without another paid call. Billing is server-owned.
      await completeStripAnalysisRequest(authenticatedUserId, canonicalTestId, result, request);
      await persistAnalysisResult({ ...body, testId: canonicalTestId }, result, authenticatedUserId, request);
      return remapAnalysisResult(result, body);
    }

    throw new EdgeAnalysisError(
      'unavailable',
      aiRun.message
        ? `שירות הניתוח אינו זמין כרגע. ${aiRun.message}`
        : 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.',
    );
  } catch (error) {
    await failStripAnalysisRequest(authenticatedUserId, canonicalTestId, error, request, providerCallStarted);
    throw error;
  }
}

async function verifyAnalysisTargets(body: AnalyzeStripRequest, userId: string, request: Request) {
  const url = Deno.env.get('SUPABASE_URL');
  if (!url) throw new EdgeAnalysisError('unavailable', 'תצורת השירות חסרה.');
  const headers = getServiceHeaders(request);
  const existing = await fetch(url + '/rest/v1/tests?select=account_id,user_id&id=eq.' +
    encodeURIComponent(body.testId), { headers, signal: AbortSignal.timeout(10000) });
  if (!existing.ok) throw new EdgeAnalysisError('unavailable', 'לא ניתן לאמת הרשאות לבדיקה.');
  const rows = await existing.json();
  if (!Array.isArray(rows) || rows.some((row) => row.account_id !== body.accountId || row.user_id !== userId))
    throw new EdgeAnalysisError('unavailable', 'הבדיקה אינה שייכת למשתמש המחובר.');
  if (body.poolId) {
    const response = await fetch(url + '/rest/v1/pools?select=id&account_id=eq.' +
      encodeURIComponent(body.accountId!) + '&id=eq.' + encodeURIComponent(body.poolId),
      { headers, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new EdgeAnalysisError('unavailable', 'לא ניתן לאמת הרשאות לבריכה.');
    const pools = await response.json();
    if (!Array.isArray(pools) || pools.length !== 1)
      throw new EdgeAnalysisError('unavailable', 'הבריכה אינה שייכת לחשבון המחובר.');
  }
}

function protectAnalysisResponse(result: StripAnalysisResult): StripAnalysisResult {
  const safeResult = { ...result };
  // Historical cached payloads may contain a treatment plan from an older client.
  delete (safeResult as unknown as Record<string, unknown>).dosage;
  const invalid = result.accepted === false || result.isValidStrip === false || result.lowConfidence;
  return {
    ...safeResult,
    recommendation: 'אמת את המדדים בבדיקה מתאימה לפני טיפול. האפליקציה אינה מחשבת כרגע מינון חומרים.',
    overallStatus: invalid ? result.overallStatus : {
      label: result.parameters.some((p) => p.status.kind !== 'ok')
        ? 'נדרש אימות לפני טיפול' : 'הערכים בטווח ההשוואה',
      tone: result.parameters.some((p) => p.status.kind !== 'ok') ? 'warning' : 'success',
    },
    parameters: result.parameters.map((p) => ({
      ...p,
      status: { ...p.status, label: p.status.kind === 'ok' ? 'בטווח ההשוואה'
        : p.status.kind === 'low' ? 'מתחת לטווח ההשוואה' : 'מעל לטווח ההשוואה' },
      recommendation: 'טווח ההשוואה אינו אישור לבטיחות המים או הוראה לטיפול.',
    })),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await readBoundedJson(request, MAX_ANALYSIS_REQUEST_BYTES)) as unknown as AnalyzeStripRequest;

    if (!body.testId || typeof body.testId !== 'string') {
      return Response.json({ error: 'missing_test_id' }, { status: 400, headers: corsHeaders });
    }

    const result = protectAnalysisResponse(await analyzeRemoteWebParity(body, request));

    return Response.json(
      {
        ok: true,
        result,
        analysisSource: result.source,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('analyze-strip failed', { code: error instanceof EdgeAnalysisError ? error.code : 'unavailable' });
    if (error instanceof EdgeAnalysisError) {
      return Response.json(
        {
          ok: false,
          code: error.code,
          message: error.message,
        },
        {
          status: error.code === 'invalid_strip' ? 422 : 503,
          headers: corsHeaders,
        },
      );
    }

    return Response.json(
      {
        ok: false,
        code: 'unavailable',
        message: 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.',
      },
      { status: 503, headers: corsHeaders },
    );
  }
});
