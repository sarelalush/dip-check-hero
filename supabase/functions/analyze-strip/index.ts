// Web-parity remote strip analysis for Supabase Edge Functions.
//
// Source-of-truth web files:
// - src/utils/analyzeStripImage.ts
// - src/lib/strip-analysis.functions.ts
// - src/utils/whiteBalance.ts
// - src/utils/colorUtils.ts
// - src/config/brandSwatches.ts
// - src/config/stripBrands.ts
// - src/config/targetRanges.ts
//
// Pipeline:
// 1. Download the uploaded image from Storage or imageUrl.
// 2. Decode it with ImageScript, then apply a gray-world white balance when possible.
// 3. Run the AI analyzer three times in parallel.
// 4. Combine numeric readings with median/agreement confidence.
// 5. If AI is unavailable or confidence is low, fall back to deterministic pixel CV.
// 6. Return remote-mock only when both AI and CV cannot produce a safe result.
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

type StatusTone = 'success' | 'warning' | 'danger';
type AnalysisSource = 'ai' | 'cv' | 'remote-mock';
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
}

interface ColorRef {
  value: number;
  rgb: Rgb;
}

interface MatchResult {
  value: number;
  distance: number;
}

interface DecodedImage {
  width: number;
  height: number;
  getPixelAt: (x: number, y: number) => number;
  setPixelAt?: (x: number, y: number, color: number) => void;
  encode?: (quality?: number) => Promise<Uint8Array> | Uint8Array;
  encodeJPEG?: (quality?: number) => Promise<Uint8Array> | Uint8Array;
}

const SCAN_IMAGES_BUCKET = 'scan-images';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const MULTI_SHOT_RUNS = 3;
const CONFIDENCE_WARN_THRESHOLD = 0.55;
const CONFIDENCE_BLOCK_THRESHOLD = 0.4;

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

const MOCK_VALUES: Record<StripParameter, number> = {
  freeChlorine: 1.5,
  totalChlorine: 2,
  bromine: 4,
  ph: 7.3,
  alkalinity: 120,
  cyanuricAcid: 40,
  hardness: 260,
  salt: 3200,
};

const PRO_COMBINED_PAD_COLORS: Array<{ tc: number; bromine: number; rgb: Rgb }> = [
  { tc: 0, bromine: 0, rgb: [254, 254, 168] },
  { tc: 0.5, bromine: 1, rgb: [242, 254, 170] },
  { tc: 1, bromine: 2, rgb: [231, 245, 160] },
  { tc: 3, bromine: 5, rgb: [184, 216, 140] },
  { tc: 5, bromine: 10, rgb: [100, 180, 105] },
  { tc: 10, bromine: 20, rgb: [55, 140, 80] },
];

const PRO_REFS: Partial<Record<StripParameter, ColorRef[]>> = {
  totalChlorine: PRO_COMBINED_PAD_COLORS.map((ref) => ({ value: ref.tc, rgb: ref.rgb })),
  bromine: PRO_COMBINED_PAD_COLORS.map((ref) => ({ value: ref.bromine, rgb: ref.rgb })),
  freeChlorine: [
    { value: 0, rgb: [254, 254, 204] },
    { value: 0.5, rgb: [247, 235, 228] },
    { value: 1, rgb: [235, 215, 225] },
    { value: 2, rgb: [220, 180, 210] },
    { value: 4, rgb: [200, 140, 195] },
    { value: 6, rgb: [175, 110, 190] },
    { value: 10, rgb: [130, 55, 160] },
    { value: 20, rgb: [70, 15, 100] },
  ],
  ph: [
    { value: 6.2, rgb: [242, 200, 90] },
    { value: 6.8, rgb: [240, 170, 130] },
    { value: 7.2, rgb: [235, 150, 150] },
    { value: 7.8, rgb: [220, 130, 165] },
    { value: 8.4, rgb: [195, 110, 170] },
  ],
  alkalinity: [
    { value: 0, rgb: [227, 192, 64] },
    { value: 40, rgb: [164, 169, 51] },
    { value: 80, rgb: [137, 159, 58] },
    { value: 120, rgb: [85, 130, 90] },
    { value: 180, rgb: [55, 105, 100] },
    { value: 240, rgb: [40, 90, 120] },
  ],
};

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
  Level 2    (TC ~2  / TB 5)   -> light green             (R184 G216 B140)
  Level 3    (TC 3   / TB ~7)  -> medium green            (R144 G198 B120)
  Level 5    (TC 5   / TB 10)  -> darker green            (R100 G180 B105)
  Level 10   (TC 10  / TB 20)  -> very dark green         (R55  G140 B80)

Pad 2 - Free Chlorine (cream -> pink -> PURPLE, NOT orange or red).
  Scale: 0, 0.5, 1, 2, 4, 6, 10, 20
  FC 0    -> pale cream              (R254 G254 B204)
  FC 0.5  -> very pale pink-cream    (R247 G235 B228)
  FC 1    -> pale pink/lavender      (R235 G215 B225)
  FC 2    -> light pink              (R220 G180 B210)
  FC 4    -> pink                    (R200 G140 B195)
  FC 6    -> medium purple-pink      (R175 G110 B190)
  FC 10   -> dark purple             (R130 G55  B160)
  FC 20   -> very dark purple        (R70  G15  B100)

Pad 3 - pH (yellow -> peach -> salmon -> PINK -> MAGENTA).
  CRITICAL OVERRIDE - IGNORE any prior training that says AquaChek pH
  goes to "red" or "dark red". On THIS strip the high-pH end is PINK /
  MAGENTA, NOT red. Apply this color->value map STRICTLY:

    * Pad mostly YELLOW (G > R-20, B < 120)               -> pH 6.2
    * Pad PEACH / light salmon (R>230, G 160-185, B<150)  -> pH 6.8
    * Pad SALMON-PINK (R>225, G 140-165, B 140-165)       -> pH 7.2
    * Pad clear PINK (R 210-230, G 120-140, B 150-180)    -> pH 7.8
    * Pad MAGENTA / hot pink (R<210, G<130, B>155, and
      B/R ratio > 0.78)                                   -> pH 8.4

  HARD RULE: if the pad is visibly pink/magenta (B channel >= G channel,
  or B > 150 with R < 230), the answer is 8.2-8.4. Reporting 7.8 for a
  pink pad is WRONG - 7.8 is a duller pink with less blue.
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

function calibratePhForBrand(value: number, brandId: string) {
  if (brandId === 'aquachek-pro-5in1' && value >= 7.75 && value <= 7.9) return 8.3;
  return value;
}

function buildParameter(brandId: string, key: StripParameter, rawValue: number): ScanResultParameter {
  const meta = PARAM_META[key];
  const value = key === 'ph' ? calibratePhForBrand(Number(rawValue), brandId) : Number(rawValue);
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
  } = {},
): StripAnalysisResult {
  const parameters = brand.parameters
    .map((parameter) => {
      const value = values[parameter];
      return typeof value === 'number' && !Number.isNaN(value)
        ? buildParameter(brand.id, parameter, Number(value.toFixed(parameter === 'ph' ? 2 : 1)))
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

function buildRemoteMockResult(request: AnalyzeStripRequest, note = 'הוחזרו ערכי דמו מרוחקים.'): StripAnalysisResult {
  const brand = getBrand(request.brandId);
  return buildResult(request, brand, MOCK_VALUES, 'remote-mock', 0.25, {
    lowConfidence: true,
    notes: note,
  });
}

function buildInvalidStripResult(
  request: AnalyzeStripRequest,
  brand: StripBrand,
  source: AnalysisSource,
  failureReason: FailureReason,
  note: string,
  options: { provider?: AiProviderName; model?: string; shotsUsed?: number; confidence?: number } = {},
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

function median(nums: number[]) {
  const sorted = [...nums].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function agreementOf(values: number[], reference: number) {
  if (values.length < 2) return 1;
  const denom = Math.max(Math.abs(reference), 1);
  const spread = (Math.max(...values) - Math.min(...values)) / denom;
  return Math.max(0, Math.min(1, 1 - spread));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rgbToLab([r, g, b]: Rgb): [number, number, number] {
  const f = (value: number) => {
    const n = value / 255;
    return n > 0.04045 ? ((n + 0.055) / 1.055) ** 2.4 : n / 12.92;
  };
  const rLinear = f(r);
  const gLinear = f(g);
  const bLinear = f(b);
  const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
  const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
  const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;
  const labF = (n: number) => (n > 0.008856 ? Math.cbrt(n) : 7.787 * n + 16 / 116);
  const fx = labF(x / 0.95047);
  const fy = labF(y / 1.0);
  const fz = labF(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE(a: Rgb, b: Rgb) {
  const labA = rgbToLab(a);
  const labB = rgbToLab(b);
  return Math.sqrt((labA[0] - labB[0]) ** 2 + (labA[1] - labB[1]) ** 2 + (labA[2] - labB[2]) ** 2);
}

function bestMatch(rgb: Rgb, refs: ColorRef[]): MatchResult {
  const lab = rgbToLab(rgb);
  let best = refs[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  let second = refs[0];
  let secondDistance = Number.POSITIVE_INFINITY;

  for (const ref of refs) {
    const distance = Math.sqrt(
      (lab[0] - rgbToLab(ref.rgb)[0]) ** 2 +
        (lab[1] - rgbToLab(ref.rgb)[1]) ** 2 +
        (lab[2] - rgbToLab(ref.rgb)[2]) ** 2,
    );
    if (distance < bestDistance) {
      second = best;
      secondDistance = bestDistance;
      best = ref;
      bestDistance = distance;
    } else if (distance < secondDistance) {
      second = ref;
      secondDistance = distance;
    }
  }

  const totalDistance = bestDistance + secondDistance;
  const bestWeight = totalDistance > 0 ? secondDistance / totalDistance : 1;
  const value = best.value * bestWeight + second.value * (1 - bestWeight);
  return { value, distance: bestDistance };
}

function getPixelRgb(image: DecodedImage, x: number, y: number): Rgb {
  return ImageScript.colorToRGB(image.getPixelAt(x, y)) as Rgb;
}

function setPixelRgb(image: DecodedImage, x: number, y: number, r: number, g: number, b: number) {
  if (!image.setPixelAt) return;
  const toColor = (ImageScript as unknown as { rgbaToColor?: (r: number, g: number, b: number, a: number) => number }).rgbaToColor;
  if (toColor) image.setPixelAt(x, y, toColor(clamp(Math.round(r), 0, 255), clamp(Math.round(g), 0, 255), clamp(Math.round(b), 0, 255), 255));
}

async function encodeImageToDataUrl(image: DecodedImage, fallbackBytes: Uint8Array, fallbackMimeType: string) {
  try {
    const encoder = image.encodeJPEG ?? image.encode;
    if (!encoder) throw new Error('ImageScript encoder is unavailable.');
    const encoded = await encoder.call(image, 92);
    return `data:image/jpeg;base64,${bytesToBase64(encoded)}`;
  } catch (error) {
    console.warn('White-balance re-encode failed, using raw data URL', error);
    return `data:${fallbackMimeType};base64,${bytesToBase64(fallbackBytes)}`;
  }
}

async function applyWhiteBalance(image: DecodedImage, originalBytes: Uint8Array, mimeType: string) {
  let rHighlights = 0;
  let gHighlights = 0;
  let bHighlights = 0;
  let highlightCount = 0;
  let rAll = 0;
  let gAll = 0;
  let bAll = 0;
  let allCount = 0;
  const stride = Math.max(1, Math.floor(Math.max(image.width, image.height) / 320));

  for (let y = 0; y < image.height; y += stride) {
    for (let x = 0; x < image.width; x += stride) {
      const [r, g, b] = getPixelRgb(image, x, y);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      rAll += r;
      gAll += g;
      bAll += b;
      allCount += 1;
      if (luma > 180 && luma < 250) {
        rHighlights += r;
        gHighlights += g;
        bHighlights += b;
        highlightCount += 1;
      }
    }
  }

  const useHighlights = highlightCount > allCount * 0.02;
  const meanR = (useHighlights ? rHighlights / highlightCount : rAll / allCount) || 1;
  const meanG = (useHighlights ? gHighlights / highlightCount : gAll / allCount) || 1;
  const meanB = (useHighlights ? bHighlights / highlightCount : bAll / allCount) || 1;
  const gray = (meanR + meanG + meanB) / 3;
  const scaleR = gray / meanR;
  const scaleG = gray / meanG;
  const scaleB = gray / meanB;
  const maxDev = Math.max(Math.abs(scaleR - 1), Math.abs(scaleG - 1), Math.abs(scaleB - 1));

  if (maxDev >= 0.03 && image.setPixelAt) {
    for (let y = 0; y < image.height; y += 1) {
      for (let x = 0; x < image.width; x += 1) {
        const [r, g, b] = getPixelRgb(image, x, y);
        setPixelRgb(image, x, y, r * scaleR, g * scaleG, b * scaleB);
      }
    }
  }

  return encodeImageToDataUrl(image, originalBytes, mimeType);
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
  const centerX = image.width / 2;
  const top = image.height * 0.2;
  const padStep = (image.height * 0.6) / padCount;
  const sampleWidth = Math.max(20, Math.min(64, image.width * 0.05));
  const sampleHeight = Math.max(20, Math.min(64, padStep * 0.5));

  return Array.from({ length: padCount }, (_, index) => {
    const x = centerX - sampleWidth / 2;
    const y = top + padStep * (index + 0.5) - sampleHeight / 2;
    return sampleAverageRgb(image, x, y, sampleWidth, sampleHeight);
  });
}

function confidenceFromDistances(distances: number[]) {
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  return clamp(1 - averageDistance / 50, 0.18, 0.95);
}

function analyzeCv(image: DecodedImage, brand: StripBrand): CvResult | null {
  if (isAquachekPro(brand)) {
    const pads = samplePads(image, 4);
    const totalChlorine = bestMatch(pads[0], PRO_REFS.totalChlorine!);
    const bromine = bestMatch(pads[0], PRO_REFS.bromine!);
    const freeChlorine = bestMatch(pads[1], PRO_REFS.freeChlorine!);
    const ph = bestMatch(pads[2], PRO_REFS.ph!);
    const alkalinity = bestMatch(pads[3], PRO_REFS.alkalinity!);
    return {
      values: {
        totalChlorine: Number(totalChlorine.value.toFixed(1)),
        bromine: Number(bromine.value.toFixed(1)),
        freeChlorine: Number(freeChlorine.value.toFixed(1)),
        ph: Number(ph.value.toFixed(1)),
        alkalinity: Math.round(alkalinity.value),
      },
      confidence: confidenceFromDistances([totalChlorine.distance, freeChlorine.distance, ph.distance, alkalinity.distance]),
      notes: 'CV fallback used fixed pad sampling and color-chart matching.',
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

  return `You are an expert pool/spa water test strip analyzer.
The user is using this strip brand: "${brand.nameHe}".
${isPro
  ? `This strip has EXACTLY 4 PHYSICAL PADS but yields 5 measurements (TC and TB share pad 1). Pad order from the wet tip toward the handle:\n${padList}`
  : `This strip has EXACTLY these pads, in this printed order from top to bottom:\n${padList}`}

FIRST determine if the image actually shows a pool/spa test strip (a thin plastic strip with multiple colored pads).
If NOT, set isStrip=false, confidence=0, all values=0, and put a short Hebrew note.
If the image shows a different strip type/brand/model than "${brand.nameHe}", classify it as unsupported_strip.

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
- Interpolate between two nearest reference levels when the pad color is
  between them; do not snap only to listed values.
- Account for white balance: if the whole image has a yellow/blue cast,
  mentally neutralize it before comparing colors.
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
      values[parameter] = parameter === 'ph' ? calibratePhForBrand(Number(rawValue), brand.id) : Number(rawValue);
    }
  }

  return {
    ok: true,
    data: {
      isStrip: Boolean(args.isStrip),
      failureReason: (args.failureReason ?? 'none') as FailureReason,
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
      values: {
        type: 'OBJECT',
        properties: valueProperties,
        required: PARAM_KEYS,
      },
    },
    required: ['isStrip', 'failureReason', 'confidence', 'notes', 'values'],
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

function combineAiRuns(runs: AiRunResponse[], request: AnalyzeStripRequest, brand: StripBrand): StripAnalysisResult | null {
  const okRuns = runs.filter((run): run is Extract<AiRunResponse, { ok: true }> => run.ok);
  const invalidRuns = okRuns.filter(
    (run) =>
      run.data.isStrip === false &&
      ['not_strip', 'blurry', 'lighting', 'framing', 'unsupported_strip'].includes(run.data.failureReason),
  );
  if (okRuns.length > 0 && invalidRuns.length > okRuns.length / 2) {
    const reasonCounts = new Map<FailureReason, number>();
    for (const run of invalidRuns) {
      reasonCounts.set(run.data.failureReason, (reasonCounts.get(run.data.failureReason) ?? 0) + 1);
    }
    const [dominantReason = 'not_strip'] = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const notes = invalidRuns.map((run) => run.data.notes).filter(Boolean).join(' ');
    return buildInvalidStripResult(
      request,
      brand,
      'ai',
      dominantReason,
      notes || (dominantReason === 'unsupported_strip'
        ? 'הסטיק שצולם אינו תואם לסוג הסטיק שנבחר. יש לבחור סטיק נתמך ולצלם שוב.'
        : 'לא זוהה סטיק בדיקה תקין בתמונה. יש לצלם שוב סטיק ברור ומלא בתוך המסגרת.'),
      {
        provider: invalidRuns[0]?.data.provider,
        model: invalidRuns[0]?.data.model,
        shotsUsed: invalidRuns.length,
        confidence: invalidRuns.reduce((sum, run) => sum + (run.data.confidence ?? 0), 0) / invalidRuns.length,
      },
    );
  }

  const stripRuns = okRuns.filter((run) => run.data.isStrip);
  if (!stripRuns.length) return null;

  const values: Partial<Record<StripParameter, number>> = {};
  const agreements: number[] = [];
  for (const parameter of brand.parameters) {
    const parameterValues = stripRuns
      .map((run) => run.data.values[parameter])
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));
    if (!parameterValues.length) continue;
    const med = median(parameterValues);
    values[parameter] = Number(med.toFixed(2));
    agreements.push(agreementOf(parameterValues, med));
  }

  if (Object.keys(values).length === 0) return null;

  const meanConfidence = stripRuns.reduce((sum, run) => sum + (run.data.confidence ?? 0.5), 0) / stripRuns.length;
  const meanAgreement = agreements.length ? agreements.reduce((sum, agreement) => sum + agreement, 0) / agreements.length : 1;
  const consensusConfidence = meanConfidence * (0.6 + 0.4 * meanAgreement);
  const lowConfidence = consensusConfidence < CONFIDENCE_WARN_THRESHOLD;

  if (consensusConfidence < CONFIDENCE_BLOCK_THRESHOLD) {
    return null;
  }

  const notes: string[] = [];
  const providers = Array.from(new Set(stripRuns.map((run) => run.data.provider))).join(', ');
  const models = Array.from(new Set(stripRuns.map((run) => run.data.model))).join(', ');
  if (providers) notes.push(`AI provider: ${providers}.`);
  if (models) notes.push(`AI model: ${models}.`);
  if (stripRuns.length < MULTI_SHOT_RUNS) notes.push(`בוצעו ${stripRuns.length} מתוך ${MULTI_SHOT_RUNS} ניתוחי AI.`);
  if (lowConfidence) notes.push('ביטחון נמוך - מומלץ לצלם שוב באור טבעי ועל רקע בהיר.');
  for (const run of stripRuns) {
    if (run.data.notes) notes.push(run.data.notes);
  }

  return buildResult(request, brand, values, 'ai', consensusConfidence, {
    lowConfidence,
    provider: stripRuns[0]?.data.provider,
    model: stripRuns[0]?.data.model,
    notes: notes.join(' ') || undefined,
    shotsUsed: stripRuns.length,
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

async function canCreateScan(accountId: string, request: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return true;

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/can_create_scan`, {
    method: 'POST',
    headers: getServiceHeaders(request),
    body: JSON.stringify({ p_account_id: accountId }),
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
    is_billable: result.source !== 'remote-mock' && result.isValidStrip !== false,
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

  if (!alreadyExists && result.source !== 'remote-mock' && result.isValidStrip !== false) {
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
      return buildRemoteMockResult(body, 'נדרשת התחברות כדי לבצע ניתוח מרוחק.');
    }

    const isMember = await verifyAccountMembership(body.accountId, authenticatedUserId, request);
    if (!isMember) {
      return buildRemoteMockResult(body, 'המשתמש אינו משויך לחשבון שנשלח לניתוח.');
    }

    const quotaAvailable = await canCreateScan(body.accountId, request);
    if (!quotaAvailable) {
      return buildRemoteMockResult(body, 'מכסת הסריקות החודשית נוצלה. הניתוח המרוחק לא הופעל.');
    }
  }

  try {
    const loaded = await loadImageBytes(body, request);
    imageBytes = loaded.bytes;
    mimeType = loaded.mimeType;
  } catch (error) {
    console.warn('remote image download failed', error);
    return buildRemoteMockResult(body, 'הורדת תמונת הסטיק נכשלה. הוחזרו ערכי דמו כדי לא לעצור את הזרימה.');
  }

  dataUrl = imageBytesToDataUrl(imageBytes, mimeType);

  try {
    image = (await ImageScript.decode(imageBytes)) as DecodedImage;
    dataUrl = await applyWhiteBalance(image, imageBytes, mimeType);
  } catch (error) {
    console.warn('remote image decode or white balance failed; continuing with raw image data for AI', error);
  }

  console.log('Starting Gemini strip analysis', {
    brandId: brand.id,
    hasDecodedImageForCv: Boolean(image),
    model: Deno.env.get('GEMINI_MODEL_PRIMARY') || Deno.env.get('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL,
    testId: body.testId,
  });

  const aiRuns = await Promise.all(
    Array.from({ length: MULTI_SHOT_RUNS }, () => analyzeWithAiProvider(dataUrl, brand)),
  );
  const aiResult = combineAiRuns(aiRuns, body, brand);
  if (aiResult && (aiResult.isValidStrip === false || !aiResult.lowConfidence)) {
    console.log('Gemini strip analysis selected', {
      confidence: aiResult.confidence,
      failureReason: aiResult.failureReason,
      model: aiResult.model,
      source: aiResult.source,
      testId: body.testId,
    });
    if (authenticatedUserId) {
      try {
        await persistAnalysisResult(body, aiResult, authenticatedUserId, request);
      } catch (error) {
        console.warn('Persisting AI analysis failed', error);
      }
    }
    return aiResult;
  }

  if (image) {
    try {
      const cv = analyzeCv(image, brand);
      if (cv) {
        const cvResult = buildResult(body, brand, cv.values, 'cv', cv.confidence, {
          lowConfidence: true,
          notes: `Gemini consensus was unavailable or low-confidence. ${cv.notes ?? ''}`.trim(),
          shotsUsed: aiRuns.filter((run) => run.ok).length,
        });
        if (authenticatedUserId) {
          try {
            await persistAnalysisResult(body, cvResult, authenticatedUserId, request);
          } catch (error) {
            console.warn('Persisting CV analysis failed', error);
          }
        }
        return cvResult;
      }
    } catch (error) {
      console.warn('CV fallback failed', error);
    }
  } else {
    console.warn('CV fallback skipped because image decoding failed before pixel sampling.');
  }

  const aiError = aiRuns.find((run): run is Extract<AiRunResponse, { ok: false }> => !run.ok);
  return buildRemoteMockResult(
    body,
    aiError?.message
      ? `ניתוח AI ו-CV לא הצליחו. ${aiError.message}`
      : 'ניתוח AI ו-CV לא הצליחו. הוחזרו ערכי דמו מרוחקים.',
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
    const result = buildRemoteMockResult(
      { testId: `fallback-${Date.now()}` },
      'אירעה שגיאה כללית בניתוח המרוחק. הוחזרו ערכי דמו כדי לא לעצור את האפליקציה.',
    );

    return Response.json(
      {
        ok: true,
        result,
        analysisSource: result.source,
      },
      { headers: corsHeaders },
    );
  }
});
