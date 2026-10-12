import type { ProductKey } from '../config/productConfig';
import type { Pool } from './pool';
import type { ScanParameterStatusKind, ScanResultParameter, StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';
import { comparisonKind } from './readingComparison';
import { buildMetricGuidance, type MetricGuidance } from './metricGuidance';

export interface DosageProduct {
  key: ProductKey;
  amount: number;
  unit: string;
  labelHe: string;
}
export interface DosageRecommendation {
  paramKey: StripParameter;
  labelHe: string;
  measured: number;
  target: number;
  unit: string;
  status: ScanParameterStatusKind;
  actionHe: string;
  product?: DosageProduct;
  active?: boolean;
  blocked?: boolean;
  exactAmountAvailable: boolean;
  guidance?: MetricGuidance;
}
export interface DosageCalculationResult {
  recommendations: DosageRecommendation[];
  primaryRecommendation?: DosageRecommendation;
  summary: string;
  safetyNote: string;
  retestNote: string;
  volumeMissing: boolean;
  policyVersion?: string;
  treatmentBlocked?: boolean;
}
export const TREATMENT_POLICY_VERSION = 'action-guidance-2026-10-12';
export const MEASUREMENT_SAFETY_NOTE = 'הערכים הם הערכה מצילום בזמן הבדיקה. ייתכנו טעויות. אין להסתמך עליהם לבדם להוספת חומרים או לאישור רחצה. יש לאמת מדידה ולפעול לפי תווית המוצר. במצב חריג או לא ברור, פנה לאיש מקצוע. אין לערבב חומרים.';
export const MEASUREMENT_ACTION = 'בחר מדד כדי לראות איך מתקנים אותו.';
export const SHORT_TREATMENT_NOTE = 'לפני הוספת חומר, אמת את החריגה מול בדיקה אמינה והוראות הציוד. אין לערבב חומרים; צילום אינו אישור רחצה.';
const ORDER: StripParameter[] = ['alkalinity', 'ph', 'freeChlorine', 'cyanuricAcid', 'salt', 'hardness'];

function statusCard(parameter: ScanResultParameter): DosageRecommendation {
  const guidance = buildMetricGuidance(parameter);
  return {
    paramKey: parameter.key,
    labelHe: parameter.name,
    measured: parameter.value,
    target: (parameter.idealRange.min + parameter.idealRange.max) / 2,
    unit: parameter.unit,
    status: comparisonKind(parameter)!,
    actionHe: guidance ? `${guidance.action}\n${guidance.followUp}` : 'נתוני המדד אינם מספיקים להנחיה.',
    guidance,
    blocked: true,
    active: false,
    exactAmountAvailable: false,
  };
}
// The current catalog has no manufacturer dosing protocols. Keep correction
// directions usable while omitting unsupported numerical quantities and timers.
export function calculateDosage(result: StripAnalysisResult, pool?: Pool): DosageCalculationResult {
  const volumeMissing = !pool || !Number.isFinite(pool.volumeLiters) || pool.volumeLiters <= 0;
  const invalidReading = result.accepted === false || result.isValidStrip === false || result.lowConfidence ||
    Boolean(result.failureReason && result.failureReason !== 'none');
  const recommendations = result.parameters
    .filter((parameter) => ORDER.includes(parameter.key) && buildMetricGuidance(parameter) !== undefined)
    .filter((parameter) => parameter.key !== 'salt' || pool?.type === 'salt')
    .map(statusCard)
    .sort((a, b) => ORDER.indexOf(a.paramKey) - ORDER.indexOf(b.paramKey))
    .map((rec) => invalidReading ? { ...rec, guidance: undefined, actionHe: 'צלם סטיק חדש וברור לפני קבלת הנחיות.' } : rec);
  // Surface one useful next step, without treating the comparison range as a
  // validated chemical protocol. High chlorine and low pH need attention first.
  const requiredReadingsPresent = ['ph', 'freeChlorine', 'alkalinity'].every((key) =>
    recommendations.some((rec) => rec.paramKey === key));
  const primaryRecommendation = invalidReading || !requiredReadingsPresent ? undefined :
    recommendations.find((rec) => rec.paramKey === 'freeChlorine' && rec.status === 'high') ??
    recommendations.find((rec) => rec.paramKey === 'ph' && rec.status === 'low') ??
    recommendations.find((rec) => rec.status !== 'ok');
  return {
    recommendations,
    primaryRecommendation,
    summary: invalidReading ? 'צלם סטיק חדש וברור לפני קבלת הנחיות.' : primaryRecommendation?.actionHe ??
      (requiredReadingsPresent ? 'המדדים שנקראו בטווח ההשוואה. המשך מעקב רגיל.' : 'הבדיקה חלקית. השלם את המדדים החסרים לפני טיפול.'),
    safetyNote: MEASUREMENT_SAFETY_NOTE,
    retestNote: 'בדוק שוב במועד שמופיע בהוראות המוצר. זמן המתנה או צילום לבדם אינם אישור רחצה.',
    volumeMissing,
    treatmentBlocked: true,
    policyVersion: TREATMENT_POLICY_VERSION,
  };
}
// Cached/cloud recommendations cannot bypass the current treatment policy.
export function protectAnalysisResult(result: StripAnalysisResult, pool?: Pool): StripAnalysisResult {
  const dosage = calculateDosage(result, pool);
  return {
    ...result,
    recommendation: dosage.summary,
    parameters: result.parameters.map((parameter) => {
      const kind = comparisonKind(parameter);
      return {
        ...parameter,
        status: {
          kind: kind ?? parameter.status.kind,
          label: kind === undefined ? 'נתוני ההשוואה אינם זמינים' : kind === 'ok' ? 'בטווח ההשוואה'
            : kind === 'low' ? 'מתחת לטווח ההשוואה' : 'מעל לטווח ההשוואה',
          tone: kind === undefined ? 'neutral' as const : kind === 'ok' ? 'success' as const : 'warning' as const,
        },
        recommendation: dosage.recommendations.find((rec) => rec.paramKey === parameter.key)?.actionHe ??
          'נתוני המדד אינם מספיקים להנחיה.',
      };
    }),
    dosage,
  };
}
