import type { StripAnalysisResult, ScanResultParameter } from './scanResults';
import { MEASUREMENT_ACTION } from './dosage';
import { comparisonKind } from './readingComparison';

export function formatReading(parameter?: ScanResultParameter) {
  if (!parameter || !Number.isFinite(parameter.value)) return '—';
  return parameter.value.toLocaleString('he-IL', {
    maximumFractionDigits: 1,
    minimumFractionDigits: parameter.key === 'ph' ? 1 : 0,
  });
}

export function resultStatus(result?: StripAnalysisResult) {
  if (!result) return { label: 'טרם בוצעה בדיקה', tone: 'neutral' as const };
  if (
    result.accepted === false ||
    result.isValidStrip === false ||
    result.lowConfidence ||
    (result.failureReason && result.failureReason !== 'none')
  ) {
    return { label: 'נדרש צילום חוזר', tone: 'warning' as const };
  }
  if (!result.parameters.length) return { label: 'פירוט הבדיקה לא זמין', tone: 'neutral' as const };
  const required = ['ph', 'freeChlorine', 'alkalinity'];
  const treatmentParameters = [
    'ph',
    'freeChlorine',
    'alkalinity',
    'cyanuricAcid',
    'salt',
    'hardness',
  ];
  if (result.parameters.some((item) => comparisonKind(item) === undefined))
    return { label: 'הבדיקה חלקית', tone: 'neutral' as const };
  if (
    result.parameters.some(
      (item) => treatmentParameters.includes(item.key) && comparisonKind(item) !== 'ok',
    ) ||
    result.dosage?.primaryRecommendation
  ) {
    return { label: 'נדרש אימות לפני טיפול', tone: 'warning' as const };
  }
  if (required.some((key) => !result.parameters.some((item) => item.key === key))) {
    return { label: 'הבדיקה חלקית', tone: 'neutral' as const };
  }
  return { label: 'הערכים בטווח ההשוואה', tone: 'success' as const };
}

export function nextAction(result?: StripAnalysisResult) {
  if (!result) return 'בצע בדיקה ראשונה כדי לקבל הערכה למדדים.';
  if (resultStatus(result).tone === 'neutral') return 'פתח את הבדיקה כדי לראות אילו נתונים זמינים.';
  if (resultStatus(result).label === 'נדרש צילום חוזר')
    return 'צלם סטיק חדש וברור לפני קבלת המלצת טיפול.';
  return MEASUREMENT_ACTION;
}
