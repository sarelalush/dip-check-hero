// Supabase Edge Function skeleton for strip analysis.
//
// Source-of-truth references from the web app:
// - src/utils/analyzeStripImage.ts
// - src/lib/strip-analysis.functions.ts
// - src/utils/colorUtils.ts
// - src/utils/whiteBalance.ts
// - src/utils/isolateStrip.ts
// - src/utils/cropToWhite.ts
//
// This function intentionally returns deterministic remote mock values for now.
// Real CV/AI color extraction should replace buildRemoteMockResult later.
// Browser-only web code should not be copied here or into Expo: canvas,
// HTMLImageElement, FileReader, document-created cropper logic, and DOM APIs.

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
  poolId?: string;
  overallStatus: {
    label: string;
    tone: StatusTone;
  };
  parameters: ScanResultParameter[];
  recommendation: string;
  source: 'remote-mock';
  confidence: number;
}

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

const BRAND_PARAMETERS: Record<string, StripParameter[]> = {
  'aquachek-pro-5in1': ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'],
  'aquachek-yellow-4': ['freeChlorine', 'ph', 'alkalinity', 'cyanuricAcid'],
  'aquachek-silver-salt': ['freeChlorine', 'ph', 'alkalinity', 'salt'],
  'aquachek-7': ['hardness', 'totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  'hth-6-way': ['totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  'clorox-3in1': ['freeChlorine', 'ph', 'alkalinity'],
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

function parameterStatus(value: number, min: number, max: number) {
  if (value < min) return { kind: 'low' as const, label: 'נמוך', tone: 'warning' as const };
  if (value > max) return { kind: 'high' as const, label: 'גבוה', tone: 'warning' as const };
  return { kind: 'ok' as const, label: 'תקין', tone: 'success' as const };
}

function parameterProgress(value: number, min: number, max: number) {
  const spread = max - min;
  const low = min - spread;
  const high = max + spread;
  return Math.max(6, Math.min(96, Math.round(((value - low) / (high - low)) * 100)));
}

function buildParameter(key: StripParameter): ScanResultParameter {
  const meta = PARAM_META[key];
  const value = MOCK_VALUES[key];
  const status = parameterStatus(value, meta.min, meta.max);
  const rangeLabel = `${meta.min} - ${meta.max}`;

  return {
    key,
    name: meta.name,
    value,
    unit: meta.unit,
    idealRange: {
      min: meta.min,
      max: meta.max,
      label: rangeLabel,
    },
    status,
    recommendation:
      status.kind === 'ok'
        ? `${meta.name} בטווח תקין.`
        : `נדרש תיקון קל עבור ${meta.name}.`,
    progress: parameterProgress(value, meta.min, meta.max),
  };
}

function buildRemoteMockResult(request: AnalyzeStripRequest): StripAnalysisResult {
  const brandId = request.brandId ?? 'aquachek-pro-5in1';
  const parameters = (BRAND_PARAMETERS[brandId] ?? BRAND_PARAMETERS['aquachek-pro-5in1']).map(buildParameter);
  const hasWarning = parameters.some((parameter) => parameter.status.tone === 'warning');

  return {
    id: request.testId,
    analyzedAt: Date.now(),
    brandId,
    imageUri: request.imageUrl ?? request.imagePath ?? request.imageUri,
    poolId: request.poolId,
    overallStatus: {
      label: hasWarning ? 'נדרש תיקון קל' : 'המים מאוזנים',
      tone: hasWarning ? 'warning' : 'success',
    },
    parameters,
    recommendation: hasWarning
      ? 'זוהתה חריגה קלה. המשיכו לפי המלצת המינון במסך התוצאות.'
      : 'המים נראים מאוזנים. המשיכו תחזוקה רגילה ובדיקה חוזרת לפי השגרה.',
    source: 'remote-mock',
    confidence: 0.82,
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
    const body = (await request.json()) as AnalyzeStripRequest;

    if (!body.testId || typeof body.testId !== 'string') {
      return Response.json({ error: 'missing_test_id' }, { status: 400, headers: corsHeaders });
    }

    const result = buildRemoteMockResult(body);

    return Response.json(
      {
        ok: true,
        result,
        analysisSource: 'remote-mock',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('analyze-strip failed', error);
    return Response.json(
      {
        ok: false,
        error: 'analysis_failed',
        message: error instanceof Error ? error.message : 'Unknown analysis error',
      },
      { status: 500, headers: corsHeaders },
    );
  }
});
