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
// - LOVABLE_API_KEY for the same Lovable AI gateway used by the web app.
// Direct Gemini API is intentionally not prioritized here; the goal is to
// reproduce the web app path through Lovable first, then CV fallback.
//
// This is V1, not lab-grade analysis. Future versions should improve strip
// detection, rotation handling, pad localization, lighting calibration, and
// chart calibration per physical strip/bottle lot. No browser APIs are used.

import { Image as ImageScript } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

type StatusTone = 'success' | 'warning' | 'danger';
type AnalysisSource = 'ai' | 'cv' | 'remote-mock';
type AiProviderName = 'lovable';
type FailureReason = 'none' | 'not_strip' | 'blurry' | 'lighting' | 'framing' | 'low_confidence' | 'ai_error' | 'unknown';
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
const LOVABLE_AI_GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const LOVABLE_AI_MODEL = 'google/gemini-2.5-flash';
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
OFFICIAL AquaChek Pro color chart. This strip has exactly 4 physical pads but
5 measurements. Pad order from wet tip to handle:
Pad 1: Total Chlorine + Total Bromine combined. Report both values.
Pad 2: Free Chlorine.
Pad 3: pH.
Pad 4: Total Alkalinity.

Pad 1 TC/TB colors: TC 0/TB 0 cream-yellow; TC 0.5/TB 1 pale yellow-green;
TC 1/TB 2 light yellow-green; TC 3/TB 5 medium green; TC 5/TB 10 darker
green; TC 10/TB 20 very dark green.
Pad 2 Free Chlorine: cream to pink to purple. It is not orange/red.
Pad 3 pH: yellow -> peach -> salmon -> pink -> magenta. High pH is pink or
magenta, not dark red. If visibly pink/magenta, report around 8.2-8.4.
Pad 4 Alkalinity: yellow-green -> green -> dark teal/blue. Teal/blue is high.
Use pH calibration: if the likely pH result is 7.75-7.9 on a high pink pad,
report 8.3.
`;

const AQUACHEK_YELLOW_CHART = `
OFFICIAL AquaChek Yellow 4-in-1 chart. Four pads top to bottom:
Pad 1 Free Chlorine: white -> pink -> magenta/purple.
Pad 2 pH: yellow -> orange -> red.
Pad 3 Total Alkalinity: yellow-green -> green -> teal.
Pad 4 Cyanuric Acid: white -> tan/gray.
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
  options: { lowConfidence?: boolean; model?: string; notes?: string; provider?: AiProviderName; shotsUsed?: number } = {},
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
  const isYellow = isAquachekYellow(brand);
  const padList = isPro
    ? [
        'Pad 1 (closest to wet tip): combined Total Chlorine + Total Bromine. Report BOTH values from this single pad color.',
        'Pad 2: Free Chlorine.',
        'Pad 3: pH.',
        'Pad 4 (closest to handle): Total Alkalinity.',
      ].join('\n')
    : brand.parameters.map((parameter, index) => `${index + 1}. ${parameter} - ${PARAM_HINTS[parameter]}`).join('\n');

  return `You are an expert pool/spa water test strip analyzer.
The user is using this strip brand: "${brand.nameHe}".
${isPro ? `This strip has exactly 4 physical pads but yields 5 measurements:\n${padList}` : `This strip has exactly these pads in printed top-to-bottom order:\n${padList}`}

First determine if the image actually shows a pool/spa test strip.
If not, set isStrip=false, confidence=0, values=0, and include a short Hebrew note.
failureReason must be one of: none, not_strip, blurry, lighting, framing, low_confidence.
For not_strip/blurry/lighting/framing set isStrip=false.
For low_confidence set isStrip=true and confidence < 0.4.
Read pads in the exact printed order. Interpolate between nearest chart levels.
Account mentally for white balance and lighting.
${isPro ? AQUACHEK_PRO_CHART : ''}${isYellow ? AQUACHEK_YELLOW_CHART : ''}
Return values via the report_strip tool. Only include the requested parameters.`;
}

function getAiProviderConfig(): AiProviderConfig | null {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (lovableKey) {
    return {
      name: 'lovable',
      apiKey: lovableKey,
      model: LOVABLE_AI_MODEL,
    };
  }

  return null;
}

function buildNumberProps() {
  const numberProps: Record<string, { type: 'number' }> = {};
  for (const key of PARAM_KEYS) numberProps[key] = { type: 'number' };
  return numberProps;
}

function normalizeAiArgs(args: Record<string, unknown>, brand: StripBrand, provider: AiProviderConfig): AiRunResponse {
  const values: Partial<Record<StripParameter, number>> = {};
  for (const parameter of brand.parameters) {
    if (typeof args[parameter] === 'number') {
      values[parameter] = parameter === 'ph' ? calibratePhForBrand(Number(args[parameter]), brand.id) : Number(args[parameter]);
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

async function analyzeWithLovable(dataUrl: string, brand: StripBrand, provider: AiProviderConfig): Promise<AiRunResponse> {
  const numberProps = buildNumberProps();
  try {
    const response = await fetch(LOVABLE_AI_GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${provider.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: LOVABLE_AI_MODEL,
        temperature: 0.1,
        top_p: 0.1,
        messages: [
          { role: 'system', content: buildSystemPrompt(brand) },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analyze this ${brand.nameHe} strip. Return values via report_strip.` },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'report_strip',
              description: 'Report parsed pool test strip values',
              parameters: {
                type: 'object',
                properties: {
                  isStrip: { type: 'boolean' },
                  failureReason: {
                    type: 'string',
                    enum: ['none', 'not_strip', 'blurry', 'lighting', 'framing', 'low_confidence'],
                  },
                  ...numberProps,
                  confidence: { type: 'number' },
                  notes: { type: 'string' },
                },
                required: ['isStrip', 'failureReason', 'confidence', 'notes'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'report_strip' } },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `lovable_${response.status}`, message: text.slice(0, 300), provider: 'lovable' };
    }

    const json = await response.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return { ok: false, error: 'lovable_no_tool_call', message: 'Lovable AI returned no tool call.', provider: 'lovable' };
    }

    const args = JSON.parse(toolCall.function.arguments);
    return normalizeAiArgs(args, brand, provider);
  } catch (error) {
    return {
      ok: false,
      error: 'lovable_exception',
      message: error instanceof Error ? error.message : 'Unexpected AI provider error.',
      provider: 'lovable',
    };
  }
}

async function analyzeWithAiProvider(dataUrl: string, brand: StripBrand): Promise<AiRunResponse> {
  const provider = getAiProviderConfig();
  if (!provider) {
    return { ok: false, error: 'missing_ai_key', message: 'AI provider is not configured.' };
  }

  return analyzeWithLovable(dataUrl, brand, provider);
}

function combineAiRuns(runs: AiRunResponse[], request: AnalyzeStripRequest, brand: StripBrand): StripAnalysisResult | null {
  const okRuns = runs.filter((run): run is Extract<AiRunResponse, { ok: true }> => run.ok);
  const notStripRuns = okRuns.filter((run) => run.data.isStrip === false);
  if (okRuns.length > 0 && notStripRuns.length > okRuns.length / 2) {
    return null;
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

async function analyzeRemoteWebParity(body: AnalyzeStripRequest, request: Request): Promise<StripAnalysisResult> {
  const brand = getBrand(body.brandId);
  let imageBytes: Uint8Array;
  let mimeType = 'image/jpeg';
  let image: DecodedImage;
  let dataUrl: string;

  try {
    const loaded = await loadImageBytes(body, request);
    imageBytes = loaded.bytes;
    mimeType = loaded.mimeType;
  } catch (error) {
    console.warn('remote image download failed', error);
    return buildRemoteMockResult(body, 'הורדת תמונת הסטיק נכשלה. הוחזרו ערכי דמו כדי לא לעצור את הזרימה.');
  }

  try {
    image = (await ImageScript.decode(imageBytes)) as DecodedImage;
    dataUrl = await applyWhiteBalance(image, imageBytes, mimeType);
  } catch (error) {
    console.warn('remote image decode or white balance failed', error);
    return buildRemoteMockResult(body, 'פענוח תמונת הסטיק נכשל. הוחזרו ערכי דמו כדי לא לעצור את הזרימה.');
  }

  const aiRuns = await Promise.all(
    Array.from({ length: MULTI_SHOT_RUNS }, () => analyzeWithAiProvider(dataUrl, brand)),
  );
  const aiResult = combineAiRuns(aiRuns, body, brand);
  if (aiResult) {
    return aiResult;
  }

  try {
    const cv = analyzeCv(image, brand);
    if (cv) {
      return buildResult(body, brand, cv.values, 'cv', cv.confidence, {
        lowConfidence: true,
        notes: `AI consensus was unavailable or low-confidence. ${cv.notes ?? ''}`.trim(),
        shotsUsed: aiRuns.filter((run) => run.ok).length,
      });
    }
  } catch (error) {
    console.warn('CV fallback failed', error);
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
