// Real Image Analysis V1 for Supabase Edge Functions.
//
// Source-of-truth references from the web app:
// - src/config/brandSwatches.ts
// - src/config/stripBrands.ts
// - src/config/targetRanges.ts
// - src/utils/colorUtils.ts
// - src/utils/analyzeStripImage.ts
// - src/lib/strip-analysis.functions.ts
//
// V1 assumptions and limitations:
// - Supports AquaChek Pro 5-in-1 first.
// - Assumes the strip is reasonably centered, vertical, and framed.
// - Samples fixed pad regions, then matches average RGB to brand swatches.
// - This is not lab-grade analysis. Later versions should improve strip
//   detection, orientation, white balance, calibration, confidence scoring,
//   and multi-shot consensus.
// - Browser-only web code must not be copied here: no canvas, FileReader,
//   HTMLImageElement, document, window, or DOM cropper logic.

import { Image as ImageScript } from 'https://deno.land/x/imagescript@1.2.15/mod.ts';

type StatusTone = 'success' | 'warning' | 'danger';
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
  source: 'remote-v1' | 'remote-mock';
  confidence: number;
  overallStatus: {
    label: string;
    tone: StatusTone;
  };
  parameters: ScanResultParameter[];
  recommendation: string;
}

interface PadSample {
  padIndex: number;
  rgb: Rgb;
  region: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface SwatchMatch {
  value: number;
  distance: number;
  rgb: Rgb;
}

interface DecodedImage {
  width: number;
  height: number;
  getPixelAt: (x: number, y: number) => number;
}

interface ProCombinedMatch {
  tc: SwatchMatch;
  bromine: SwatchMatch;
}

const SCAN_IMAGES_BUCKET = 'scan-images';

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

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

const PRO_REFS: Record<'freeChlorine' | 'ph' | 'alkalinity', Array<{ value: number; rgb: Rgb }>> = {
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

function buildParameter(key: StripParameter, value: number): ScanResultParameter {
  const meta = PARAM_META[key];
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

function buildRemoteMockResult(request: AnalyzeStripRequest, note = 'הוחזרו ערכי דמו מרוחקים.'): StripAnalysisResult {
  const brandId = request.brandId ?? 'aquachek-pro-5in1';
  const parameters: StripParameter[] =
    brandId === 'aquachek-pro-5in1'
      ? ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity']
      : ['freeChlorine', 'ph', 'alkalinity', 'salt'];
  const resultParameters = parameters.map((key) => buildParameter(key, MOCK_VALUES[key]));

  return {
    id: request.testId,
    analyzedAt: Date.now(),
    brandId,
    imageUri: request.imageUrl ?? request.imagePath ?? request.imageUri,
    imagePath: request.imagePath,
    imageUrl: request.imageUrl,
    poolId: request.poolId,
    source: 'remote-mock',
    confidence: 0.25,
    overallStatus: {
      label: 'נדרש תיקון קל',
      tone: 'warning',
    },
    parameters: resultParameters,
    recommendation: note,
  };
}

function rgbToLab([r, g, b]: Rgb): [number, number, number] {
  const f = (v: number) => {
    const n = v / 255;
    return n > 0.04045 ? ((n + 0.055) / 1.055) ** 2.4 : n / 12.92;
  };
  const rLinear = f(r);
  const gLinear = f(g);
  const bLinear = f(b);
  const x = rLinear * 0.4124 + gLinear * 0.3576 + bLinear * 0.1805;
  const y = rLinear * 0.2126 + gLinear * 0.7152 + bLinear * 0.0722;
  const z = rLinear * 0.0193 + gLinear * 0.1192 + bLinear * 0.9505;
  const labF = (value: number) => (value > 0.008856 ? Math.cbrt(value) : 7.787 * value + 16 / 116);
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

function bestMatch(rgb: Rgb, refs: Array<{ value: number; rgb: Rgb }>): SwatchMatch {
  let best = refs[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ref of refs) {
    const distance = deltaE(rgb, ref.rgb);
    if (distance < bestDistance) {
      best = ref;
      bestDistance = distance;
    }
  }

  return {
    value: best.value,
    distance: bestDistance,
    rgb: best.rgb,
  };
}

function bestCombinedMatch(rgb: Rgb): ProCombinedMatch {
  let best = PRO_COMBINED_PAD_COLORS[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ref of PRO_COMBINED_PAD_COLORS) {
    const distance = deltaE(rgb, ref.rgb);
    if (distance < bestDistance) {
      best = ref;
      bestDistance = distance;
    }
  }

  return {
    tc: { value: best.tc, distance: bestDistance, rgb: best.rgb },
    bromine: { value: best.bromine, distance: bestDistance, rgb: best.rgb },
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
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
      const [pr, pg, pb] = ImageScript.colorToRGB(image.getPixelAt(px, py));
      r += pr;
      g += pg;
      b += pb;
      count += 1;
    }
  }

  if (count === 0) throw new Error('No pixels sampled from pad region.');
  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)];
}

function sampleProPads(image: DecodedImage): PadSample[] {
  const padCount = 4;
  const centerX = image.width / 2;
  const top = image.height * 0.2;
  const padStep = (image.height * 0.6) / padCount;
  const sampleWidth = Math.max(8, Math.min(42, image.width * 0.045));
  const sampleHeight = Math.max(8, Math.min(42, padStep * 0.38));

  return Array.from({ length: padCount }, (_, index) => {
    const x = centerX - sampleWidth / 2;
    const y = top + padStep * (index + 0.5) - sampleHeight / 2;
    return {
      padIndex: index,
      rgb: sampleAverageRgb(image, x, y, sampleWidth, sampleHeight),
      region: {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(sampleWidth),
        height: Math.round(sampleHeight),
      },
    };
  });
}

function confidenceFromDistances(distances: number[]) {
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;
  return clamp(Number((1 - averageDistance / 80).toFixed(2)), 0.18, 0.95);
}

function analyzeAquachekPro(image: DecodedImage, request: AnalyzeStripRequest): StripAnalysisResult {
  const samples = sampleProPads(image);
  const combined = bestCombinedMatch(samples[0].rgb);
  const freeChlorine = bestMatch(samples[1].rgb, PRO_REFS.freeChlorine);
  const ph = bestMatch(samples[2].rgb, PRO_REFS.ph);
  const alkalinity = bestMatch(samples[3].rgb, PRO_REFS.alkalinity);
  const distances = [combined.tc.distance, freeChlorine.distance, ph.distance, alkalinity.distance];
  const confidence = confidenceFromDistances(distances);
  const parameters = [
    buildParameter('totalChlorine', combined.tc.value),
    buildParameter('bromine', combined.bromine.value),
    buildParameter('freeChlorine', freeChlorine.value),
    buildParameter('ph', ph.value),
    buildParameter('alkalinity', alkalinity.value),
  ];
  const hasWarning = parameters.some((parameter) => parameter.status.tone === 'warning');

  return {
    id: request.testId,
    analyzedAt: Date.now(),
    brandId: 'aquachek-pro-5in1',
    imageUri: request.imageUrl ?? request.imagePath ?? request.imageUri,
    imagePath: request.imagePath,
    imageUrl: request.imageUrl,
    poolId: request.poolId,
    source: 'remote-v1',
    confidence,
    overallStatus: {
      label: hasWarning ? 'נדרש תיקון קל' : 'המים מאוזנים',
      tone: hasWarning ? 'warning' : 'success',
    },
    parameters,
    recommendation: hasWarning
      ? 'ניתוח remote-v1 זיהה ערך אחד או יותר מחוץ לטווח. בדקו את המלצת המינון במסך התוצאות.'
      : 'ניתוח remote-v1 מצא את הערכים בטווח תקין.',
  };
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
  const response = await fetch(storageUrl, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`Storage image download failed (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function fetchImageBytesFromUrl(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Image URL download failed (${response.status}).`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function loadImageBytes(body: AnalyzeStripRequest, request: Request) {
  if (body.imagePath && !body.imagePath.startsWith('http')) {
    return fetchImageBytesFromStorage(body.imagePath, request);
  }

  const url = body.imageUrl ?? (body.imagePath?.startsWith('http') ? body.imagePath : undefined);
  if (url) {
    return fetchImageBytesFromUrl(url);
  }

  throw new Error('No imagePath or imageUrl was provided for remote-v1 analysis.');
}

async function analyzeRemoteV1(body: AnalyzeStripRequest, request: Request): Promise<StripAnalysisResult> {
  if ((body.brandId ?? 'aquachek-pro-5in1') !== 'aquachek-pro-5in1') {
    return buildRemoteMockResult(
      body,
      'מותג הסטיק עדיין לא נתמך ב-remote-v1. הוחזרו ערכי דמו עד להשלמת כיול המותג.',
    );
  }

  let imageBytes: Uint8Array;
  try {
    imageBytes = await loadImageBytes(body, request);
  } catch (error) {
    console.warn('remote-v1 image download failed', error);
    return buildRemoteMockResult(
      body,
      'הורדת תמונת הסטיק נכשלה. הבדיקה נשמרה עם ערכי דמו מרוחקים עד שניתן יהיה לנתח את התמונה.',
    );
  }

  try {
    const image = (await ImageScript.decode(imageBytes)) as DecodedImage;
    return analyzeAquachekPro(image, body);
  } catch (error) {
    console.warn('remote-v1 image decode or sampling failed', error);
    return buildRemoteMockResult(
      body,
      'פענוח תמונת הסטיק נכשל. הוחזרו ערכי דמו מרוחקים כדי לא לעצור את זרימת השמירה.',
    );
  }
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

    const result = await analyzeRemoteV1(body, request);

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
    const safeBody = { testId: `fallback-${Date.now()}` };
    const result = buildRemoteMockResult(
      safeBody,
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
