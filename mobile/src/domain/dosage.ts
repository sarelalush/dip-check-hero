import type { ProductKey } from '../config/productConfig';
import type { Pool } from './pool';
import type { ScanParameterStatusKind, ScanResultParameter, StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';
import { PARAM_LABEL_HE } from './strip';
import { getChlorineReview, comparisonKind, needsReadingVerification, readingNeedsClarification } from './readingComparison';
import { buildChlorineActionPlan, buildMetricGuidance, type MetricGuidance } from './metricGuidance';

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
  comparisonRange?: { min: number; max: number };
  unit: string;
  status: ScanParameterStatusKind;
  actionHe: string;
  product?: DosageProduct;
  active?: boolean;
  blocked?: boolean;
  exactAmountAvailable: boolean;
  guidance?: MetricGuidance;
  verificationSuggested?: boolean;
  actionUncertain?: boolean;
  alternativeMeasured?: number;
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
export const TREATMENT_POLICY_VERSION = 'volume-based-opening-portions-2026-10-20';
export const MEASUREMENT_SAFETY_NOTE = 'הערכים הם הערכה מצילום בזמן הבדיקה. ייתכנו טעויות. אין להסתמך עליהם לבדם להוספת חומרים או לאישור רחצה. יש לאמת מדידה ולפעול לפי תווית המוצר. במצב חריג או לא ברור, פנה לאיש מקצוע. אין לערבב חומרים.';
export const MEASUREMENT_ACTION = 'בחר מדד כדי לראות איך מתקנים אותו.';
export const SHORT_TREATMENT_NOTE = 'לפני הוספת חומר, אמת את החריגה מול בדיקה אמינה והוראות הציוד. אין לערבב חומרים; צילום אינו אישור רחצה.';
export const TREATMENT_ORDER: StripParameter[] = ['alkalinity', 'ph', 'freeChlorine', 'cyanuricAcid', 'salt', 'hardness'];

function orderedSteps(parameter: ScanResultParameter, guidance: MetricGuidance): string {
  const kind = comparisonKind(parameter);
  if (kind === 'ok') return readingNeedsClarification(parameter)
    ? 'ההתאמה למקרא אינה חד־משמעית. בצע סריקה חדשה לפני הוספת חומר.'
    : 'לפי ההערכה, אין צורך בתיקון מדד זה.';
  const action = guidance.action.replace(/^אם החריגה אומתה, /, '');
  if (parameter.key === 'freeChlorine' && kind === 'high') {
    return [
      'אל תוסיף כלור נוסף; הפחת או השהה הזנת כלור לפי הוראות המערכת.',
      'המשך סחרור לפי הוראות המערכת.',
      'בדוק שוב כלור חופשי ו־pH כדי לעקוב אחרי ירידת הרמה.',
      'חזור לרחצה רק כשהמדדים עומדים בדרישות המוצר ומערכת החיטוי.',
    ].join('\n');
  }
  return [
    readingNeedsClarification(parameter) ? `אם בדיקה נוספת אישרה את החריגה: ${action}` : action,
    'הפעל סחרור לפי הוראות המוצר והמערכת.',
    'המתן למשך הזמן שמופיע בהוראות המוצר.',
    'בצע בדיקה חדשה. הטיפול הבא ייקבע לפי התוצאות החדשות.',
  ].join('\n');
}

function statusCard(parameter: ScanResultParameter): DosageRecommendation {
  const guidance = buildMetricGuidance(parameter);
  return {
    paramKey: parameter.key,
    labelHe: PARAM_LABEL_HE[parameter.key].labelHe,
    measured: parameter.value,
    target: (parameter.idealRange.min + parameter.idealRange.max) / 2,
    comparisonRange: { min: parameter.idealRange.min, max: parameter.idealRange.max },
    unit: parameter.unit,
    status: comparisonKind(parameter)!,
    actionHe: guidance ? orderedSteps(parameter, guidance) : 'נתוני המדד אינם מספיקים להנחיה.',
    guidance,
    verificationSuggested: needsReadingVerification(parameter),
    actionUncertain: readingNeedsClarification(parameter),
    alternativeMeasured: parameter.evidence?.modelCertainty === 'adjacent'
      ? parameter.evidence.alternativeValue : undefined,
    blocked: true,
    active: false,
    exactAmountAvailable: false,
  };
}
// Current eligibility is recalculated; an optional treatmentPlan separately
// archives the original instructions/quantity for reading in history. Archives
// cannot authorize another dose. The stored legacy product branch stays disabled.
export function calculateDosage(result: StripAnalysisResult, pool?: Pool): DosageCalculationResult {
  const volumeMissing = !pool || !Number.isFinite(pool.volumeLiters) || pool.volumeLiters <= 0;
  const invalidReading = result.accepted === false || result.isValidStrip === false || result.lowConfidence ||
    Boolean(result.failureReason && result.failureReason !== 'none');
  const chlorineReview = getChlorineReview(result.parameters);
  const chlorinePlan = chlorineReview ? buildChlorineActionPlan(chlorineReview) : undefined;
  const totalChlorine = result.parameters.find(parameter => parameter.key === 'totalChlorine');
  const totalOutsideRange = totalChlorine && comparisonKind(totalChlorine) !== undefined && comparisonKind(totalChlorine) !== 'ok';
  let recommendations = result.parameters
    .filter((parameter) => TREATMENT_ORDER.includes(parameter.key) && buildMetricGuidance(parameter) !== undefined)
    .filter((parameter) => parameter.key !== 'salt' || pool?.type === 'salt')
    .map(statusCard)
    .sort((a, b) => TREATMENT_ORDER.indexOf(a.paramKey) - TREATMENT_ORDER.indexOf(b.paramKey))
    .map((rec) => invalidReading ? { ...rec, guidance: undefined, actionHe: 'צלם סטיק חדש וברור לפני קבלת הנחיות.' } : rec);
  // One current action: when both TA and pH are low, correct TA first. Otherwise
  // low pH retains priority over an acid treatment for high TA.
  const requiredReadingsPresent = ['ph', 'freeChlorine', 'alkalinity'].every((key) =>
    recommendations.some((rec) => rec.paramKey === key)) &&
    (result.brandId !== 'aquachek-pro-5in1' || result.parameters.some(parameter =>
      parameter.key === 'totalChlorine' && Number.isFinite(parameter.value) && parameter.value >= 0));
  const ph = recommendations.find(rec => rec.paramKey === 'ph');
  const alkalinity = recommendations.find(rec => rec.paramKey === 'alkalinity');
  // Use the current readings to choose one safe action. A pH reading that may
  // already be low must be clarified before an alkalinity-lowering treatment;
  // this is not a plan to correct a possible future change in pH.
  const mayHaveLowPh = ph?.actionUncertain && (
    !ph.comparisonRange || ph.alternativeMeasured === undefined ||
    !Number.isFinite(ph.alternativeMeasured) || ph.alternativeMeasured < ph.comparisonRange.min
  );
  let primaryRecommendation = invalidReading || !requiredReadingsPresent ? undefined :
    ph?.status === 'low' && alkalinity?.status === 'low' ? alkalinity :
    ph?.status === 'low' || (alkalinity?.status === 'high' && mayHaveLowPh) ? ph :
    recommendations.find((rec) => rec.status !== 'ok');
  // Keep alkalinity/pH correction first, and address excessive free chlorine
  // before any chlorine shock plan. A pair problem overrides a separate
  // free-chlorine addition and later optional metrics.
  if (chlorineReview && primaryRecommendation &&
      !['alkalinity', 'ph'].includes(primaryRecommendation.paramKey) &&
      !(primaryRecommendation.paramKey === 'freeChlorine' && primaryRecommendation.status === 'high'))
    primaryRecommendation = undefined;
  if (primaryRecommendation) {
    // Avoid suggesting an alkalinity-lowering acid when pH is already low.
    if (primaryRecommendation.paramKey === 'ph' && primaryRecommendation.status === 'low' &&
      recommendations.some(rec => rec.paramKey === 'alkalinity' && rec.status === 'high')) {
      primaryRecommendation = { ...primaryRecommendation, actionHe: [
        'אמת את ה־pH ואל תוסיף חומר להורדת אלקליניות.',
        'קבל הנחיית תיקון שמתאימה גם לאלקליניות הגבוהה.',
        'פעל לפי הוראות הטיפול שאושרו למים שלך.',
        'בצע בדיקה חדשה לפני מעבר למדד הבא.',
      ].join('\n') };
    }
    primaryRecommendation = { ...primaryRecommendation, active: true };
    recommendations = recommendations.map(rec =>
      rec.paramKey === primaryRecommendation!.paramKey ? primaryRecommendation! : rec);
  }
  return {
    recommendations,
    primaryRecommendation,
    summary: invalidReading ? 'צלם סטיק חדש וברור לפני קבלת הנחיות.' : primaryRecommendation?.actionHe.split('\n')[0] ?? chlorinePlan?.summary ??
      (!requiredReadingsPresent ? 'הבדיקה חלקית. בצע סריקה חדשה לקבלת המדדים החסרים.'
        : totalOutsideRange ? 'הכלור הכולל מחוץ לטווח ההשוואה. קרא אותו יחד עם הכלור החופשי לפני בחירת טיפול.'
        : recommendations.some(rec => rec.actionUncertain) || (totalChlorine && readingNeedsClarification(totalChlorine))
          ? 'בחלק מהקריאות לא התקבלה התאמה חד־משמעית למקרא. בצע סריקה חדשה לפני טיפול.'
          : 'לפי ההערכה, המדדים בטווח ההשוואה. אין צורך בתיקון כדי להגיע למרכז הטווח.'),
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
  const chlorineReview = getChlorineReview(result.parameters);
  const chlorinePlan = chlorineReview ? buildChlorineActionPlan(chlorineReview) : undefined;
  return {
    ...result,
    recommendation: dosage.summary,
    parameters: result.parameters.map((parameter) => {
      const kind = comparisonKind(parameter);
      const actionUncertain = readingNeedsClarification(parameter);
      const unclearTotalChlorine = parameter.key === 'totalChlorine' && actionUncertain;
      const chlorineIssue = parameter.key === 'totalChlorine' ? chlorineReview : undefined;
      return {
        ...parameter,
        name: PARAM_LABEL_HE[parameter.key].labelHe,
        status: {
          kind: kind ?? parameter.status.kind,
          label: chlorineIssue ? chlorineIssue.reason === 'gap' ? 'חשד לכלור קשור' : 'קריאות סותרות'
            : unclearTotalChlorine ? 'נדרש צילום חוזר' : kind === undefined ? 'נתוני ההשוואה אינם זמינים' : kind === 'ok' ? 'בטווח לפי ההערכה'
            : kind === 'low' ? 'מתחת לטווח ההשוואה' : 'מעל לטווח ההשוואה',
          tone: unclearTotalChlorine || chlorineIssue ? 'warning' as const : kind === undefined ? 'neutral' as const : kind === 'ok' ? 'success' as const : 'warning' as const,
        },
        recommendation: chlorineReview && (parameter.key === 'freeChlorine' || parameter.key === 'totalChlorine')
          ? chlorinePlan!.summary : dosage.recommendations.find((rec) => rec.paramKey === parameter.key)?.actionHe ??
          'נתוני המדד אינם מספיקים להנחיה.',
      };
    }),
    dosage,
  };
}
