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
// 2. Decode it only for diagnostics. Never alter pad colors before analysis.
// 3. Run the AI analyzer three times in parallel as an image-quality gate.
// 4. For AquaChek Pro, sample the four localized pads and match their colors
//    deterministically to the manufacturer's discrete chart.
// 5. AI decides whether the uploaded image is a valid supported strip, but it
//    does not decide the AquaChek Pro numerical readings.
// 6. If AI cannot validate the strip or color matching is uncertain, return a
//    clear invalid response.
// 7. If the AI provider is unavailable, return a service-unavailable response.
//
// Required secrets for AI mode:
// - GEMINI_API_KEY for direct server-side Gemini API access.
// - STRIP_AI_PROVIDER=gemini is optional; Gemini is the only production provider.
// - GEMINI_MODEL_PRIMARY is optional; defaults to gemini-2.5-flash-lite.
// - GEMINI_MODEL_ESCALATION is reserved for later high-confidence escalation.
// Mobile never receives the Gemini key. It only invokes this Edge Function.
//
// This is V1, not lab-grade analysis. Future versions should improve strip
// detection, rotation handling, pad localization, lighting calibration, and
// chart calibration per physical strip/bottle lot. No browser APIs are used.

import { Image as ImageScript } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';
import {
  AQUACHEK_PRO_REFS as PRO_REFS,
  analyzeAquachekProDiscretePadRgbs,
  bestMatch,
  confidenceFromDistances,
  getFixedPadSampleRegions,
  getFixedWhiteReferenceRegion,
  measureAquachekProSharpness,
} from '../_shared/aquachek-pro-reference.js';

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
  whiteReference?: Rgb;
  sharpnessVariance?: number;
  minimumSharpnessVariance?: number;
}

interface AnalysisEvidence {
  method: 'repeated-model-discrete-consensus' | 'gemini-quality-deterministic-color';
  requiredRuns: number;
  successfulRuns: number;
  qualityPassedRuns: number;
  confidencePassedRuns: number;
  runConfidences: number[];
  expectedPhysicalPadCount: number;
  detectedPhysicalPadCounts: number[];
  fullyVisiblePadRuns: number;
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
}

interface AiRunData {
  isStrip: boolean;
  failureReason: FailureReason;
  physicalPadCount: number;
  allPadsFullyVisible: boolean;
  values: Partial<Record<StripParameter, number>>;
  confidence: number;
  notes: string;
  provider: AiProviderName;
  model: string;
}

type AiRunResponse =
  | { ok: true; data: AiRunData }
  | { ok: false; error: string; message?: string; provider?: AiProviderName };

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
}

const SCAN_IMAGES_BUCKET = 'scan-images';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const MULTI_SHOT_RUNS = 3;
const REQUIRED_CONSENSUS_RUNS = 2;
const ANALYSIS_VERSION = 'aquachek-pro-v6-quality-color-separation';
const MIN_ACCEPTED_RUN_CONFIDENCE = 0.75;
const MIN_ACCEPTED_MEAN_CONFIDENCE = 0.8;
const MIN_ACCEPTED_CV_CONFIDENCE = 0.6;
const MIN_AQUACHEK_SHARPNESS_VARIANCE = 120;

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
  If pad 4 looks blue/turquoise, report 220-240 (usually 240).

ORIENTATION RULE: if the strip in the image is rotated, identify orientation
by color signatures: the pH pad is the only orange/red pad; the alkalinity
pad is the only one that can look teal/blue. Use those as anchors to
determine which physical end is the wet tip (pad 1) vs the handle (pad 4).
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
  return ImageScript.colorToRGB(image.getPixelAt(x, y)) as Rgb;
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

function samplePads(image: DecodedImage, padCount: number) {
  return getFixedPadSampleRegions(image.width, image.height, padCount).map((region) =>
    sampleAverageRgb(image, region.x, region.y, region.width, region.height),
  );
}

function sampleWhiteReference(image: DecodedImage) {
  const region = getFixedWhiteReferenceRegion(image.width, image.height);
  return sampleAverageRgb(image, region.x, region.y, region.width, region.height);
}

function analyzeCv(image: DecodedImage, brand: StripBrand): CvResult | null {
  if (isAquachekPro(brand)) {
    const pads = samplePads(image, 4);
    const whiteReference = sampleWhiteReference(image);
    const sharpness = measureAquachekProSharpness(
      image.width,
      image.height,
      (x: number, y: number) => getPixelRgb(image, x, y),
    );
    const analysis = analyzeAquachekProDiscretePadRgbs(pads, {
      whiteReference,
    });
    return {
      values: analysis.values,
      confidence: analysis.confidence,
      notes: 'Gemini validated image quality; readings came from deterministic manufacturer-chart color matching.',
      evidence: {
        confidence: analysis.confidence,
        distances: analysis.distances,
        margins: analysis.margins,
        padRgbs: pads,
        selectedValues: analysis.values,
        whiteReference,
        sharpnessVariance: sharpness.variance,
        minimumSharpnessVariance: MIN_AQUACHEK_SHARPNESS_VARIANCE,
      },
    };
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

function buildSystemPrompt(brand: StripBrand) {
  const isPro = isAquachekPro(brand);
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

Before reading any values, count the separate PHYSICAL REAGENT PADS that are actually visible in the image:
- Count only real reagent pads attached to the plastic strip.
- Do NOT count white gaps, the plastic handle, shadows, glare, printed marks, or stains as pads.
- Do NOT infer or reconstruct a hidden, removed, cropped, or missing pad from the expected strip layout.
- Set physicalPadCount to the number you can directly see and set allPadsFullyVisible=true only when every pad is completely visible and none is cropped.
- This selected strip must show exactly ${expectedPhysicalPadCount} complete physical pads. If the count is different, or any pad is only partly visible, set failureReason="framing", isStrip=false, confidence=0, and all values=0.
- A strip with only 3 visible pads is INVALID even when the remaining colors are sharp and readable. Never estimate the missing measurement.

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

  const expectedPhysicalPadCount = isAquachekPro(brand) ? 4 : brand.parameters.length;
  const reportedPadCount = Number(args.physicalPadCount ?? 0);
  const physicalPadCount = Number.isFinite(reportedPadCount) ? Math.max(0, Math.round(reportedPadCount)) : 0;
  const allPadsFullyVisible = args.allPadsFullyVisible === true;
  const padGatePassed = physicalPadCount === expectedPhysicalPadCount && allPadsFullyVisible;
  const reportedFailureReason = (args.failureReason ?? 'none') as FailureReason;
  const failureReason = !padGatePassed && ['none', 'low_confidence'].includes(reportedFailureReason)
    ? 'framing'
    : reportedFailureReason;

  return {
    ok: true,
    data: {
      isStrip: Boolean(args.isStrip) && padGatePassed,
      failureReason,
      physicalPadCount,
      allPadsFullyVisible,
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

    if (response.status === 429) {
      return { ok: false, error: 'rate_limit', message: 'יותר מדי בקשות, נסה שוב בעוד רגע', provider: 'gemini' };
    }
    if (!response.ok) {
      const text = await response.text();
      console.error('Gemini API error:', response.status, text);
      return { ok: false, error: 'gemini_error', message: `שגיאה (${response.status})`, provider: 'gemini' };
    }

    const json = await response.json();
    const args = extractGeminiJson(json as Record<string, unknown>);
    return normalizeAiArgs(args, brand, provider);
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

function manufacturerLevelsFor(brand: StripBrand, parameter: StripParameter) {
  const references = isAquachekPro(brand)
    ? PRO_REFS[parameter]
    : isAquachekYellow(brand)
      ? YELLOW_REFS[parameter]
      : undefined;

  return references?.map((reference) => reference.value) ?? [];
}

function snapToManufacturerLevel(value: number, levels: number[]) {
  if (!levels.length) return undefined;

  return levels.reduce((nearest, level) =>
    Math.abs(level - value) < Math.abs(nearest - value) ? level : nearest,
  levels[0]);
}

function mostCommonValue(values: number[]): [number | undefined, number] {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [undefined, 0];
}

function safeFailureReason(reason: FailureReason): FailureReason {
  return ['not_strip', 'blurry', 'lighting', 'framing', 'unsupported_strip', 'low_confidence'].includes(reason)
    ? reason
    : 'low_confidence';
}

function combineAiRuns(
  runs: AiRunResponse[],
  request: AnalyzeStripRequest,
  brand: StripBrand,
  cvResult?: CvResult | null,
): StripAnalysisResult | null {
  const okRuns = runs.filter((run): run is Extract<AiRunResponse, { ok: true }> => run.ok);
  if (!okRuns.length) return null;

  const expectedPhysicalPadCount = isAquachekPro(brand) ? 4 : brand.parameters.length;
  const runConfidences = okRuns.map((run) => Number(run.data.confidence ?? 0));
  const qualityPassedRuns = okRuns.filter(
    (run) => {
      const colorReadingUncertaintyOnly =
        isAquachekPro(brand) &&
        run.data.isStrip === true &&
        run.data.failureReason === 'low_confidence';
      return (
        run.data.isStrip === true &&
        (run.data.failureReason === 'none' || colorReadingUncertaintyOnly) &&
        run.data.physicalPadCount === expectedPhysicalPadCount &&
        run.data.allPadsFullyVisible === true
      );
    },
  );
  const confidencePassedRuns = qualityPassedRuns.filter(
    (run) => Number(run.data.confidence ?? 0) >= MIN_ACCEPTED_RUN_CONFIDENCE,
  );
  const confidencePassedValues = confidencePassedRuns.map((run) => Number(run.data.confidence ?? 0));
  const evidence: AnalysisEvidence = {
    method: isAquachekPro(brand) ? 'gemini-quality-deterministic-color' : 'repeated-model-discrete-consensus',
    requiredRuns: MULTI_SHOT_RUNS,
    successfulRuns: okRuns.length,
    qualityPassedRuns: qualityPassedRuns.length,
    confidencePassedRuns: confidencePassedRuns.length,
    runConfidences,
    expectedPhysicalPadCount,
    detectedPhysicalPadCounts: okRuns.map((run) => run.data.physicalPadCount),
    fullyVisiblePadRuns: okRuns.filter((run) => run.data.allPadsFullyVisible).length,
    requiredParameters: [...brand.parameters],
    parameters: {},
    ...(cvResult?.evidence ? { colorAnalysis: cvResult.evidence } : {}),
  };
  const provider = okRuns[0]?.data.provider;
  const model = okRuns[0]?.data.model;
  const meanConfidence = confidencePassedValues.length
    ? confidencePassedValues.reduce((sum, confidence) => sum + confidence, 0) / confidencePassedValues.length
    : 0;

  const reject = (reason: FailureReason, note: string, acceptanceReasons: string[]) =>
    buildInvalidStripResult(request, brand, 'ai', safeFailureReason(reason), note, {
      provider,
      model,
      shotsUsed: okRuns.length,
      confidence: meanConfidence,
      analysisVersion: ANALYSIS_VERSION,
      acceptanceReasons,
      evidence,
    });

  if (okRuns.length < REQUIRED_CONSENSUS_RUNS) {
    return reject(
      'low_confidence',
      'לא התקבלו מספיק קריאות מלאות. יש לצלם שוב כדי למנוע תוצאה חלקית.',
      [`Only ${okRuns.length} analysis run completed; ${REQUIRED_CONSENSUS_RUNS} are required.`],
    );
  }

  const qualityFailures = okRuns.filter((run) => !qualityPassedRuns.includes(run));
  if (qualityPassedRuns.length < REQUIRED_CONSENSUS_RUNS) {
    const reasonCounts = new Map<FailureReason, number>();
    for (const run of qualityFailures) {
      reasonCounts.set(run.data.failureReason, (reasonCounts.get(run.data.failureReason) ?? 0) + 1);
    }
    const [dominantReason = 'low_confidence'] = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const notes = uniqueNonEmpty(qualityFailures.map((run) => run.data.notes)).join(' ');
    return reject(
      dominantReason,
      notes || 'אחת מקריאות האיכות זיהתה בעיה בצילום. יש לצלם שוב סטיק מלא, חד וללא סנוור.',
      [
        `Only ${qualityPassedRuns.length} of ${okRuns.length} completed runs passed image quality.`,
        ...qualityFailures.map(
          (run) =>
            `Quality gate failed: ${run.data.failureReason}; detected ${run.data.physicalPadCount}/${expectedPhysicalPadCount} complete pads.`,
        ),
      ],
    );
  }

  if (
    !isAquachekPro(brand) &&
    (confidencePassedRuns.length < REQUIRED_CONSENSUS_RUNS || meanConfidence < MIN_ACCEPTED_MEAN_CONFIDENCE)
  ) {
    return reject(
      'low_confidence',
      'רמת הביטחון בצבעי הסטיק נמוכה מדי. יש לצלם שוב באור טבעי ואחיד וללא השתקפות.',
      [
        `${REQUIRED_CONSENSUS_RUNS} runs must each be at least ${MIN_ACCEPTED_RUN_CONFIDENCE}.`,
        `Mean confidence of supporting runs must be at least ${MIN_ACCEPTED_MEAN_CONFIDENCE}.`,
      ],
    );
  }

  if (isAquachekPro(brand)) {
    if (!cvResult) {
      return reject(
        'low_confidence',
        'לא הצלחנו לקרוא את צבעי הפדים בצורה אמינה. יש לצלם שוב כשהסטיק ישר וממלא את המסגרת.',
        ['The deterministic color analyzer could not decode the AquaChek Pro image.'],
      );
    }

    const sharpnessVariance = cvResult.evidence?.sharpnessVariance ?? 0;
    if (sharpnessVariance < MIN_AQUACHEK_SHARPNESS_VARIANCE) {
      return reject(
        'blurry',
        'התמונה מטושטשת מדי לקריאה אמינה. יש לצלם שוב כשהסטיק חד ויציב.',
        [
          `Deterministic sharpness variance ${sharpnessVariance.toFixed(3)} is below ${MIN_AQUACHEK_SHARPNESS_VARIANCE}.`,
        ],
      );
    }

    if (cvResult.confidence < MIN_ACCEPTED_CV_CONFIDENCE) {
      return reject(
        'low_confidence',
        'ההתאמה בין צבעי הפדים לטבלת היצרן אינה ודאית. יש לצלם שוב באור אחיד וללא השתקפות.',
        [
          `Deterministic color confidence ${cvResult.confidence.toFixed(3)} is below ${MIN_ACCEPTED_CV_CONFIDENCE}.`,
        ],
      );
    }

    const values: Partial<Record<StripParameter, number>> = {};
    for (const parameter of brand.parameters) {
      const chartValues = manufacturerLevelsFor(brand, parameter);
      const selectedValue = cvResult.values[parameter];
      evidence.parameters[parameter] = {
        chartValues,
        rawValues: typeof selectedValue === 'number' ? [selectedValue] : [],
        snappedValues: typeof selectedValue === 'number' ? [selectedValue] : [],
        selectedValue,
        agreementCount: typeof selectedValue === 'number' ? 1 : 0,
        requiredAgreement: 1,
      };

      if (!chartValues.includes(selectedValue as number)) {
        return reject(
          'low_confidence',
          `לא התקבלה התאמת צבע תקינה עבור ${PARAM_META[parameter].name}. יש לצלם שוב את כל ארבעת הפדים.`,
          [`No deterministic manufacturer-chart value was produced for ${parameter}.`],
        );
      }
      values[parameter] = selectedValue;
    }

    return buildResult(
      request,
      brand,
      values,
      'ai',
      cvResult.confidence,
      {
        provider,
        model,
        notes: cvResult.notes,
        shotsUsed: okRuns.length,
        lowConfidence: false,
        isValidStrip: true,
        failureReason: 'none',
        analysisVersion: ANALYSIS_VERSION,
        accepted: true,
        acceptanceReasons: [
          `At least ${REQUIRED_CONSENSUS_RUNS} Gemini runs validated image quality and four complete pads.`,
          `Deterministic sharpness variance ${sharpnessVariance.toFixed(3)} passed the ${MIN_AQUACHEK_SHARPNESS_VARIANCE} minimum.`,
          'All readings matched the nearest discrete AquaChek Pro manufacturer-chart color.',
        ],
        evidence,
      },
    );
  }

  const values: Partial<Record<StripParameter, number>> = {};
  for (const parameter of brand.parameters) {
    const chartValues = manufacturerLevelsFor(brand, parameter);
    const rawValues = confidencePassedRuns
      .map((run) => run.data.values[parameter])
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const snappedValues = rawValues
      .map((value) => snapToManufacturerLevel(value, chartValues))
      .filter((value): value is number => typeof value === 'number');
    const [selectedValue, agreementCount] = mostCommonValue(snappedValues);
    const parameterEvidence: ParameterAnalysisEvidence = {
      chartValues,
      rawValues,
      snappedValues,
      selectedValue,
      agreementCount,
      requiredAgreement: REQUIRED_CONSENSUS_RUNS,
    };
    evidence.parameters[parameter] = parameterEvidence;

    if (
      chartValues.length === 0 ||
      rawValues.length < REQUIRED_CONSENSUS_RUNS ||
      snappedValues.length < REQUIRED_CONSENSUS_RUNS ||
      agreementCount < REQUIRED_CONSENSUS_RUNS ||
      typeof selectedValue !== 'number'
    ) {
      return reject(
        'low_confidence',
        `לא התקבלה התאמה חד-משמעית עבור ${PARAM_META[parameter].name}. יש לצלם שוב ללא צל או סנוור.`,
        [`No ${REQUIRED_CONSENSUS_RUNS}-run manufacturer-level majority for ${parameter}.`],
      );
    }

    values[parameter] = selectedValue;
  }

  if (isAquachekPro(brand)) {
    const chlorineIndex = PRO_REFS.totalChlorine?.findIndex(
      (reference) => reference.value === values.totalChlorine,
    ) ?? -1;
    const bromineIndex = PRO_REFS.bromine?.findIndex(
      (reference) => reference.value === values.bromine,
    ) ?? -2;
    const combinedPadMatches = chlorineIndex >= 0 && chlorineIndex === bromineIndex;

    if (!combinedPadMatches) {
      return reject(
        'low_confidence',
        'הקריאה המשולבת של כלור כללי וברום אינה עקבית. יש לצלם שוב את הסטיק.',
        ['Total chlorine and bromine did not resolve to the same combined-pad chart index.'],
      );
    }
  }

  const notes = uniqueNonEmpty(confidencePassedRuns.map((run) => run.data.notes));
  const ignoredRuns = Math.max(0, MULTI_SHOT_RUNS - confidencePassedRuns.length);
  return buildResult(request, brand, values, 'ai', Math.min(...confidencePassedValues), {
    provider,
    model,
    notes: notes.join(' ') || undefined,
    shotsUsed: okRuns.length,
    lowConfidence: false,
    isValidStrip: true,
    failureReason: 'none',
    analysisVersion: ANALYSIS_VERSION,
    accepted: true,
    acceptanceReasons: [
      `At least ${REQUIRED_CONSENSUS_RUNS} runs passed image quality and confidence gates.`,
      `Every manufacturer-level reading reached a ${REQUIRED_CONSENSUS_RUNS}-run majority.`,
      ...(ignoredRuns > 0 ? [`Ignored ${ignoredRuns} non-supporting analysis run.`] : []),
    ],
    evidence,
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
  let image: DecodedImage | undefined;
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

  try {
    image = (await ImageScript.decode(imageBytes)) as DecodedImage;
    console.log('Decoded source image without color modification', {
      width: image.width,
      height: image.height,
      mimeType,
    });
  } catch (error) {
    console.warn('remote image decode failed; continuing with raw image data for AI', error);
  }

  console.log('Starting Gemini strip analysis', {
    brandId: brand.id,
    hasDecodedImageForAiPrep: Boolean(image),
    model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
    testId: body.testId,
  });

  const aiRuns = await Promise.all(
    Array.from({ length: MULTI_SHOT_RUNS }, () => analyzeWithAiProvider(dataUrl, brand)),
  );
  const cvResult = image && isAquachekPro(brand) ? analyzeCv(image, brand) : null;
  const aiResult = combineAiRuns(aiRuns, body, brand, cvResult);
  if (aiResult) {
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
    return aiResult;
  }

  const aiError = aiRuns.find((run): run is Extract<AiRunResponse, { ok: false }> => !run.ok);
  throw new EdgeAnalysisError(
    'unavailable',
    aiError?.message
      ? `שירות הניתוח אינו זמין כרגע. ${aiError.message}`
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
