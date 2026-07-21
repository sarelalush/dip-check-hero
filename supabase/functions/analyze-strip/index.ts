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
// 2. Send the original image and the brand prompt to Gemini exactly once.
// 3. Validate the JSON response shape and return Gemini's values to the app.
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
  robustRgbFromSamples,
} from '../_shared/aquachek-pro-reference.js';
import { readZeroBasedImageScriptRgb } from '../_shared/imagescript-pixel.js';

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
}

interface ColorAnalysisEvidence {
  confidence: number;
  distances: Partial<Record<StripParameter, number>>;
  margins: Partial<Record<StripParameter, number>>;
  padRgbs: Rgb[];
  selectedValues: Partial<Record<StripParameter, number>>;
  padCenterYs?: number[];
  modelPadCenterYs?: number[];
  modelPadBoxes?: NormalizedPadBox[];
  padLocalization?: 'model-boxes' | 'structure-refined';
  localizationCandidates?: Array<{
    confidence: number;
    padCenterYs?: number[];
    padLocalization: 'model-boxes' | 'structure-refined';
  }>;
  whiteReference?: Rgb;
  sharpnessVariance?: number;
  minimumSharpnessVariance?: number;
  structure?: ReturnType<typeof analyzeAquachekProStructure>;
  horizontalLocalization?: ReturnType<typeof locateAquachekProStripCenterX>;
  deskewAngle?: number;
}

interface AnalysisEvidence {
  method:
    | 'repeated-model-discrete-consensus'
    | 'repeated-model-chart-consensus'
    | 'gemini-quality-deterministic-color'
    | 'gemini-pad-boxes-deterministic-color';
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
  confidence: number;
  notes: string;
  provider: AiProviderName;
  model: string;
}

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
const ANALYSIS_VERSION = 'aquachek-pro-v23-gemini-3-5';
const MIN_ACCEPTED_CV_CONFIDENCE = 0.32;
// Real phone captures remain readable well below the synthetic-image score.
// A threshold of 4 accepts ordinary camera softness while still rejecting
// clearly out-of-focus captures (validated against progressively blurred
// real strip crops).
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
  freeChlorine: { name: 'כלור', unit: 'ppm', min: 1, max: 3 },
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

const AQUACHEK_PRO_CHART = `
OFFICIAL AquaChek Pro color chart (memorize and use this - do NOT guess
colors from generic strip knowledge).

CRITICAL - STRIP HAS 4 PHYSICAL PADS, NOT 5. Pad order from the WET TIP
(end you dipped in the water) toward the HANDLE (dry end you hold):

  Pad 1 (closest to wet tip): Total Chlorine + Total Bromine (COMBINED).
    One pad, two scales - same color reading gives both TC and TB values.
  Pad 2: Free Chlorine.
  Pad 3: pH.
  Pad 4 (closest to handle / dry end): Total Alkalinity.

Pad 1 - Total Chlorine + Total Bromine (yellow -> green -> dark green).
  TC scale: 0, 0.5, 1, 3, 5, 10
  TB scale: 0, 1,   2, 5, 10, 20
  (same color, two scales - report BOTH values from this single pad)
  Level 0    (TC 0   / TB 0)   -> very pale cream-yellow  (R254 G254 B168)
  Level 0.5  (TC 0.5 / TB 1)   -> pale yellow-green       (R242 G254 B170)
  Level 1    (TC 1   / TB 2)   -> light yellow-green      (R231 G245 B160)
  Level 3    (TC 3   / TB 5)   -> light green             (R184 G216 B140)
  Level 5    (TC 5   / TB 10)  -> darker green            (R100 G180 B105)
  Level 10   (TC 10  / TB 20)  -> very dark green         (R55  G140 B80)

Pad 2 - Free Chlorine (cream -> pink -> PURPLE, NOT orange or red).
  Scale: 0, 0.5, 1, 3, 5, 10, 20
  FC 0    -> pale cream              (R254 G254 B204)
  FC 0.5  -> very pale pink-cream    (R247 G235 B228)
  FC 1    -> pale pink/lavender      (R235 G215 B225)
  FC 3    -> light purple            (R220 G180 B210)
  FC 5    -> purple                  (R190 G125 B192)
  FC 10   -> dark purple             (R130 G55  B160)
  FC 20   -> very dark purple        (R70  G15  B100)

Pad 3 - pH (yellow -> peach -> salmon -> PINK -> MAGENTA).
  Scale: 6.2, 6.8, 7.2, 7.8, 8.4
  pH 6.2  -> yellow              (R245 G215 B100)
  pH 6.8  -> peach               (R240 G170 B130)
  pH 7.2  -> salmon-pink         (R235 G150 B150)
  pH 7.8  -> pink                (R220 G130 B165)
  pH 8.4  -> magenta             (R195 G110 B170)

Pad 4 - Total Alkalinity (yellow-green -> green -> dark teal).
  Scale: 0, 40, 80, 120, 180, 240
  TA 0    -> yellow-green    (R227 G192 B64)
  TA 40   -> olive green     (R164 G169 B51)
  TA 80   -> green           (R137 G159 B58)
  TA 120  -> green w/ blue tint (R85  G130 B90)
  TA 180  -> dark teal-green (R55  G105 B100)
  TA 240  -> deep teal-blue  (R40  G90  B120)
  IMPORTANT: a blue / cyan / turquoise alkalinity pad is HIGH alkalinity.
  Do NOT report 120 for a teal-blue pad; 120 is dark green only.
  If pad 4 looks blue/turquoise, report the exact printed level 240.

ORIENTATION RULE: determine the wet tip and handle from physical geometry.
The handle is the longer blank plastic section after pad 4. Never infer or
reverse pad order from expected chemistry colors.
`;

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
): CvResult {
  if (normalizedPadBoxes?.length !== 4) {
    throw new Error('AquaChek Pro requires four model-localized reagent pad boxes.');
  }

  const getRgb = (x: number, y: number) => getPixelRgb(image, x, y);
  const normalizedCenterYs = normalizedPadBoxes.map((box) => box.centerY);
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

  // This local detector is diagnostic only. It no longer decides where pad
  // colors are sampled; every reagent pad uses its own Gemini bounding box.
  const horizontalLocalization = locateAquachekProStripCenterX(
    image.width,
    image.height,
    getRgb,
    normalizedCenterYs,
  );
  const structure = analyzeAquachekProStructure(
    image.width,
    image.height,
    getRgb,
    modelCenterX * image.width,
    normalizedCenterYs,
    modelStripWidth,
  );
  const whiteReference = structure.carrierReference;
  const sharpness = measureAquachekProSharpness(
    image.width,
    image.height,
    getRgb,
    modelCenterX * image.width,
    modelStripWidth,
    normalizedCenterYs,
  );
  const pads = samplePadBoxes(image, normalizedPadBoxes);
  const analysis = analyzeAquachekProDiscretePadRgbs(pads, { whiteReference });
  return {
    values: analysis.values,
    confidence: analysis.confidence,
    notes: 'Gemini localized each reagent pad; readings came from deterministic manufacturer-chart color matching inside those boxes.',
    evidence: {
      confidence: analysis.confidence,
      distances: analysis.distances,
      margins: analysis.margins,
      padRgbs: pads,
      selectedValues: analysis.values,
      padCenterYs: normalizedCenterYs,
      modelPadCenterYs: normalizedCenterYs,
      modelPadBoxes: normalizedPadBoxes,
      padLocalization: 'model-boxes',
      localizationCandidates: [{
        confidence: analysis.confidence,
        padCenterYs: normalizedCenterYs,
        padLocalization: 'model-boxes',
      }],
      whiteReference,
      sharpnessVariance: sharpness.variance,
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
    // manufacturer-color checks still make the final acceptance decision.
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

function buildSystemPrompt(brand: StripBrand) {
  const isPro = isAquachekPro(brand);
  if (isPro) {
    return `You are the sole color reader for an AquaChek Pro 5-in-1 pool test strip.
Read the supplied photograph directly against the official chart below. No
downstream pixel sampler will replace your readings, so inspect every pad
carefully and perform a second visual comparison before returning JSON.

VALIDITY GATE - keep it deliberately practical for real phone photos:
- A valid image shows one real test-strip candidate with exactly four visible,
  physically intact reagent pads.
- A real strip must include a narrow neutral/white plastic carrier with the
  reagent pads physically attached to it. Four colors by themselves are not
  evidence of a test strip.
- People, faces, body parts, furniture, ordinary scenes, screenshots, charts,
  bottle labels and unrelated objects are NOT test strips. Never guess water
  values for those images. Return isStrip=false, failureReason="not_strip" and
  zero values when the actual carrier and attached pads are not visible.
- Accept normal phone-photo conditions: background around the strip, a hand,
  crop padding, tilt, perspective, uneven sunlight, shadows, mild glare, mild
  blur, wet texture, printed marks, and a handle that is only partly visible.
- Do not require pad bounding boxes, a perfectly exposed white carrier, a
  vertical strip, a tight crop, or laboratory lighting.
- Use low_confidence with isStrip=true when the strip and all four pads are
  readable but a color is near two chart levels. Do not reject merely because
  the crop or lighting is imperfect.
- Reject only when there is no real strip, the strip has other than four pads,
  a pad is physically cropped/covered/torn, or severe blur/glare makes a pad's
  representative color genuinely unreadable.

PAD ORDER AND ORIENTATION:
- Determine orientation from physical geometry, never from expected chemistry.
- The handle is the longer blank plastic section after pad 4; the opposite end
  is the wet tip. Rotation in the image does not change this order.
- From wet tip toward handle the four physical pads are:
  1. combined Total Chlorine and Total Bromine
  2. Free Chlorine
  3. pH
  4. Total Alkalinity
- Read the representative center color of each complete pad. Ignore shadows,
  highlights, edge darkening, wet mottling, the carrier, hand and background.

READING RULES:
- Compare each pad only with its own row in the official chart.
- Return exactly one printed level. Never interpolate or invent a value.
- Pad 1 has one color and two linked scales. Its TC/TB pair must come from the
  same chart column.
- RGB values are semantic anchors for the printed swatches, not a request to
  sample raw pixels or apply white balance.
- Recheck all four choices once before returning the final JSON.

${AQUACHEK_PRO_CHART}

Set physicalPadCount to the directly visible physical-pad count.
Set allPadsFullyVisible and allPadsIntact true when all four complete pads can
be read. Bounding boxes and the remaining structural fields are diagnostic
only: provide best-effort values, but do not fail an otherwise readable strip
because those diagnostics are uncertain. Always provide a short Hebrew note.
Return only JSON matching the provided response schema.`;
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
${isPro ? AQUACHEK_PRO_CHART : ''}${isYellow ? AQUACHEK_YELLOW_CHART : ''}
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

  const reportedPadCount = Number(args.physicalPadCount ?? 0);
  const physicalPadCount = Number.isFinite(reportedPadCount) ? Math.max(0, Math.round(reportedPadCount)) : 0;
  const allPadsFullyVisible = args.allPadsFullyVisible === true;
  const hasExactlyOneStrip = args.hasExactlyOneStrip === true;
  const hasSingleContinuousStripBody = args.hasSingleContinuousStripBody === true;
  const allPadsIntact = args.allPadsIntact === true;
  const padOrderMatchesSelectedBrand = args.padOrderMatchesSelectedBrand === true;
  const hasExtraPadLikeRegions = args.hasExtraPadLikeRegions === true;
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
  visiblePadEntries.sort((left, right) => left.box.centerY - right.box.centerY);
  const visiblePadBoxes = visiblePadEntries.map((entry) => entry.box);
  const visiblePadCenterYs = visiblePadBoxes.map((box) => box.centerY);
  const padIntegrity = visiblePadEntries.map((entry) => entry.intact);
  const stripBodyEvidence = ['clear_shared_body', 'ambiguous', 'none'].includes(String(args.stripBodyEvidence))
    ? (args.stripBodyEvidence as AiRunData['stripBodyEvidence'])
    : 'none';
  const reportedFailureReason = (args.failureReason ?? 'none') as FailureReason;
  const modelIdentifiedStrip = Boolean(args.isStrip);
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
      confidence: Number(args.confidence ?? 0.5),
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

function buildGeminiResponseSchema() {
  const valueProperties: Record<string, { type: 'NUMBER' }> = {};
  for (const key of PARAM_KEYS) valueProperties[key] = { type: 'NUMBER' };

  return {
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

async function analyzeWithGemini(dataUrl: string, brand: StripBrand, provider: AiProviderConfig): Promise<AiRunResponse> {
  try {
    const inlineData = dataUrlToGeminiInlineData(dataUrl);
    const modelPath = provider.model.startsWith('models/') ? provider.model.slice('models/'.length) : provider.model;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelPath)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemPrompt(brand) }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text:
                    `Analyze this ${brand.nameHe} pool test strip. ` +
                    'Return only the required JSON object matching the schema. Use 0 for values not present on this strip.',
                },
                { inlineData },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            topP: 0.1,
            responseMimeType: 'application/json',
            responseSchema: buildGeminiResponseSchema(),
          },
        }),
      },
    );

    const errorText = response.ok ? '' : await response.text();
    if (response.status === 429) {
      console.error('Gemini API rate limit:', {
        model: modelPath,
        providerError: errorText.slice(0, 1500),
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
      console.error('Gemini API error:', response.status, errorText);
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

async function analyzeWithAiProvider(dataUrl: string, brand: StripBrand): Promise<AiRunResponse> {
  const provider = getAiProviderConfig();
  if (!provider) {
    return { ok: false, error: 'missing_ai_key', message: 'AI provider is not configured.' };
  }

  return analyzeWithGemini(dataUrl, brand, provider);
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
  const acceptedFailureReason = data.failureReason === 'none' || data.failureReason === 'low_confidence';

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

async function fetchImageBytesFromStorage(path: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is not configured in the Edge Function environment.');
  }

  const authorization = serviceRoleKey
    ? `Bearer ${serviceRoleKey}`
    : request.headers.get('Authorization') ?? request.headers.get('authorization') ?? '';
  const storageUrl = `${supabaseUrl}/storage/v1/object/${SCAN_IMAGES_BUCKET}/${encodeStoragePath(path)}`;
  const headers: Record<string, string> = {};
  if (authorization) headers.Authorization = authorization;
  if (serviceRoleKey || anonKey) headers.apikey = serviceRoleKey ?? anonKey ?? '';

  const response = await fetch(storageUrl, { headers });
  if (!response.ok) {
    throw new Error(`Storage image download failed (${response.status}).`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type')?.startsWith('image/') ? response.headers.get('content-type')! : 'image/jpeg',
  };
}

async function fetchImageBytesFromUrl(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image URL download failed (${response.status}).`);
  }

  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    mimeType: response.headers.get('content-type')?.startsWith('image/') ? response.headers.get('content-type')! : 'image/jpeg',
  };
}

function loadImageBytesFromDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
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
    mimeType: match[1]?.startsWith('image/') ? match[1] : 'image/jpeg',
  };
}

async function loadImageBytes(body: AnalyzeStripRequest, request: Request) {
  if (body.imagePath && !body.imagePath.startsWith('http')) {
    return fetchImageBytesFromStorage(body.imagePath, request);
  }

  const url = body.imageUrl ?? (body.imagePath?.startsWith('http') ? body.imagePath : undefined);
  if (url) {
    return fetchImageBytesFromUrl(url);
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
    `${supabaseUrl}/rest/v1/account_members?select=id&account_id=eq.${encodeURIComponent(accountId)}&user_id=eq.${encodeURIComponent(userId)}&limit=1`,
    {
      headers: getServiceHeaders(request),
    },
  );

  if (!response.ok) return false;
  const rows = await response.json();
  return Array.isArray(rows) && rows.length > 0;
}

async function canCreateScan(accountId: string, userId: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return true;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/can_create_scan_for_user`, {
    method: 'POST',
    headers: getServiceHeaders(request),
    body: JSON.stringify({ p_account_id: accountId, p_user_id: userId }),
  });

  if (!response.ok) return true;
  return Boolean(await response.json());
}

async function persistAnalysisResult(body: AnalyzeStripRequest, result: StripAnalysisResult, userId: string, request: Request) {
  if (!body.accountId) return;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return;

  const headers = getServiceHeaders(request);
  const existingResponse = await fetch(
    `${supabaseUrl}/rest/v1/tests?select=id&id=eq.${encodeURIComponent(body.testId)}&limit=1`,
    { headers },
  );
  const existingRows = existingResponse.ok ? await existingResponse.json() : [];
  const alreadyExists = Array.isArray(existingRows) && existingRows.length > 0;

  const testRow = {
    account_id: body.accountId,
    analyzed_at: new Date(result.analyzedAt).toISOString(),
    analysis_status: 'completed',
    confidence: result.confidence,
    error_message: result.lowConfidence ? result.notes ?? null : null,
    id: body.testId,
    image_path: result.imagePath ?? body.imagePath ?? null,
    image_url: result.imageUrl ?? body.imageUrl ?? null,
    is_billable: result.isValidStrip !== false,
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
    confidence: result.confidence,
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
    await fetch(`${supabaseUrl}/rest/v1/test_readings?on_conflict=test_id,parameter_key`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(readingRows),
    });
  }

  await fetch(`${supabaseUrl}/rest/v1/test_recommendations?test_id=eq.${encodeURIComponent(body.testId)}`, {
    method: 'DELETE',
    headers,
  });
  await fetch(`${supabaseUrl}/rest/v1/test_recommendations`, {
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

  if (!alreadyExists && result.isValidStrip !== false) {
    await fetch(`${supabaseUrl}/rest/v1/rpc/register_scan_usage`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        p_account_id: body.accountId,
        p_test_id: body.testId,
        p_user_id: userId,
      }),
    });
  }
}

async function analyzeRemoteWebParity(body: AnalyzeStripRequest, request: Request): Promise<StripAnalysisResult> {
  const brand = getBrand(body.brandId);
  let imageBytes: Uint8Array;
  let mimeType = 'image/jpeg';
  let dataUrl: string;
  let authenticatedUserId = body.userId;

  if (body.accountId) {
    authenticatedUserId = await getAuthenticatedUserId(request);
    if (!authenticatedUserId) {
      throw new EdgeAnalysisError('unavailable', 'נדרשת התחברות כדי לבצע ניתוח AI.');
    }

    const isMember = await verifyAccountMembership(body.accountId, authenticatedUserId, request);
    if (!isMember) {
      throw new EdgeAnalysisError('unavailable', 'המשתמש אינו משויך לחשבון שנשלח לניתוח.');
    }

    const quotaAvailable = await canCreateScan(body.accountId, authenticatedUserId, request);
    if (!quotaAvailable) {
      throw new EdgeAnalysisError('unavailable', 'מכסת הסריקות החודשית נוצלה. כרגע לא ניתן לבצע ניתוח נוסף.');
    }
  }

  try {
    const loaded = await loadImageBytes(body, request);
    imageBytes = loaded.bytes;
    mimeType = loaded.mimeType;
  } catch (error) {
    console.warn('remote image download failed', error);
    throw new EdgeAnalysisError('unavailable', 'לא הצלחנו לטעון את תמונת הסטיק לניתוח. נסו שוב בעוד כמה דקות.');
  }

  dataUrl = imageBytesToDataUrl(imageBytes, mimeType);

  console.log('Starting Gemini strip analysis', {
    brandId: brand.id,
    model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
    testId: body.testId,
  });

  const aiRun = await analyzeWithAiProvider(dataUrl, brand);
  const tokenUsage = summarizeGeminiTokenUsage([aiRun]);
  console.log('Gemini token usage for scan', {
    aiCallCount: 1,
    model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
    testId: body.testId,
    ...tokenUsage,
  });
  if (aiRun.ok) {
    const aiResult = buildSingleAiResult(aiRun, body, brand);
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
    // Keep persistence in the mobile save flow only. The app enriches the AI
    // result with dosage recommendations before upserting tests/readings and
    // registering usage. Writing here as well can create duplicate history
    // rows when a mobile save follows the remote analysis response.
    return { ...aiResult, tokenUsage };
  }

  throw new EdgeAnalysisError(
    'unavailable',
    aiRun.message
      ? `שירות הניתוח אינו זמין כרגע. ${aiRun.message}`
      : 'שירות הניתוח אינו זמין כרגע. נסו שוב בעוד כמה דקות.',
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'method_not_allowed' }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = (await request.json()) as AnalyzeStripRequest;

    if (!body.testId || typeof body.testId !== 'string') {
      return Response.json({ error: 'missing_test_id' }, { status: 400, headers: corsHeaders });
    }

    const result = await analyzeRemoteWebParity(body, request);

    return Response.json(
      {
        ok: true,
        result,
        analysisSource: result.source,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('analyze-strip failed', error);
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
