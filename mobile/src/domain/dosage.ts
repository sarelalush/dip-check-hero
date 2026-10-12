import type { ProductKey } from '../config/productConfig';
import type { Pool } from './pool';
import type { ScanParameterStatusKind, ScanResultParameter, StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';
import { comparisonKind } from './readingComparison';

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
export const TREATMENT_POLICY_VERSION = 'measurement-only-2026-10-11';
export const MEASUREMENT_SAFETY_NOTE = 'הערכים הם הערכה מצילום בזמן הבדיקה. ייתכנו טעויות. אין להסתמך עליהם לבדם להוספת חומרים או לאישור רחצה. יש לאמת מדידה ולפעול לפי תווית המוצר ואיש מקצוע. אין לערבב חומרים.';
export const MEASUREMENT_ACTION = 'אמת את המדדים בבדיקה מתאימה לפני טיפול. האפליקציה אינה מחשבת כרגע מינון חומרים.';
const ORDER: StripParameter[] = ['alkalinity', 'ph', 'freeChlorine', 'cyanuricAcid', 'salt', 'hardness'];

function statusCard(parameter: ScanResultParameter): DosageRecommendation {
  return {
    paramKey: parameter.key,
    labelHe: parameter.name,
    measured: parameter.value,
    target: (parameter.idealRange.min + parameter.idealRange.max) / 2,
    unit: parameter.unit,
    status: comparisonKind(parameter)!,
    actionHe: 'להשוואה בלבד; יש לאמת לפני טיפול.',
    blocked: true,
    active: false,
    exactAmountAvailable: false,
  };
}
// No doses, predicted tablet credits, replacement percentages or fixed waiting
// periods until a product-specific treatment protocol is professionally validated.
export function calculateDosage(result: StripAnalysisResult, pool?: Pool): DosageCalculationResult {
  const volumeMissing = !pool || !Number.isFinite(pool.volumeLiters) || pool.volumeLiters <= 0;
  return {
    recommendations: result.parameters
      .filter((parameter) => ORDER.includes(parameter.key) && comparisonKind(parameter) !== undefined)
      .map(statusCard)
      .sort((a, b) => ORDER.indexOf(a.paramKey) - ORDER.indexOf(b.paramKey)),
    summary: MEASUREMENT_ACTION,
    safetyNote: MEASUREMENT_SAFETY_NOTE,
    retestNote: 'מועד בדיקה חוזרת וכניסה למים נקבעים לפי המצב והוראות היצרן ואיש מקצוע; אין כאן זמן המתנה מאושר.',
    volumeMissing,
    treatmentBlocked: true,
    policyVersion: TREATMENT_POLICY_VERSION,
  };
}
// Cached/cloud recommendations cannot bypass the current treatment policy.
export function protectAnalysisResult(result: StripAnalysisResult, pool?: Pool): StripAnalysisResult {
  return {
    ...result,
    recommendation: MEASUREMENT_ACTION,
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
        recommendation: 'טווח ההשוואה אינו אישור לבטיחות המים או הוראה לטיפול.',
      };
    }),
    dosage: calculateDosage(result, pool),
  };
}
