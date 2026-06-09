import type { ScanResultParameter, StripAnalysisResult } from '../domain/scanResults';

interface AnalyzeStripImageMockInput {
  brandId?: string;
  imageUri?: string;
  poolId?: string;
}

const mockParameters: ScanResultParameter[] = [
  {
    key: 'ph',
    name: 'pH',
    value: 7.3,
    unit: '',
    idealRange: { min: 7.2, max: 7.6, label: 'טווח מומלץ 7.2-7.6' },
    status: { kind: 'ok', label: 'תקין', tone: 'success' },
    recommendation: 'ה-pH נמצא בטווח תקין.',
    progress: 68,
  },
  {
    key: 'freeChlorine',
    name: 'כלור',
    value: 1.5,
    unit: 'ppm',
    idealRange: { min: 1, max: 3, label: 'טווח מומלץ 1.0-3.0' },
    status: { kind: 'ok', label: 'תקין', tone: 'success' },
    recommendation: 'רמת הכלור טובה לשחייה.',
    progress: 52,
  },
  {
    key: 'alkalinity',
    name: 'אלקליניות',
    value: 120,
    unit: 'ppm',
    idealRange: { min: 80, max: 120, label: 'טווח מומלץ 80-120' },
    status: { kind: 'ok', label: 'תקין', tone: 'success' },
    recommendation: 'האלקליניות יציבה.',
    progress: 86,
  },
  {
    key: 'salt',
    name: 'מלח',
    value: 3200,
    unit: 'ppm',
    idealRange: { min: 3000, max: 3500, label: 'טווח מומלץ 3000-3500' },
    status: { kind: 'high', label: 'גבוה', tone: 'warning' },
    recommendation: 'בדקו שוב את רמת המלח לפני תיקון.',
    progress: 74,
  },
];

function cloneMockParameters() {
  return mockParameters.map((parameter) => ({
    ...parameter,
    idealRange: { ...parameter.idealRange },
    status: { ...parameter.status },
  }));
}

export async function analyzeStripImageMock({
  brandId,
  imageUri,
  poolId,
}: AnalyzeStripImageMockInput): Promise<StripAnalysisResult> {
  await new Promise((resolve) => {
    setTimeout(resolve, 650);
  });

  const analyzedAt = Date.now();
  const parameters = cloneMockParameters();
  const hasWarning = parameters.some((parameter) => parameter.status.tone === 'warning');

  return {
    id: `analysis-${analyzedAt}`,
    analyzedAt,
    brandId,
    imageUri,
    poolId,
    source: 'mock',
    confidence: 0.76,
    overallStatus: {
      label: hasWarning ? 'נדרש תיקון קל' : 'המים מאוזנים',
      tone: hasWarning ? 'warning' : 'success',
    },
    parameters,
    recommendation: 'הוסף 120 מ״ל כלור והוסף 80 גרם אלקליניות+',
  };
}
