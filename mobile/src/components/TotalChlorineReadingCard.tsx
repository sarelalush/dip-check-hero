import type { ScanResultParameter } from '../domain/scanResults';
import { readingNeedsClarification, type ChlorineReview } from '../domain/readingComparison';
import type { PadColor } from '../domain/padColor';
import { MeasurementCard } from './MeasurementCard';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';
import { totalChlorinePresentation } from '../domain/chlorinePresentation';

interface Props {
  parameter?: ScanResultParameter;
  chlorineReview?: ChlorineReview;
  padColor?: PadColor;
  padPosition?: number;
}

function formatValue(value: number, unit: string) {
  return `\u2066${value.toLocaleString('he-IL', { maximumFractionDigits: 1 })} ${unit}\u2069`;
}

// Classify against this total-chlorine reading's own supplied range. Keep the
// separate pairwise warning; the classification never determines a chemical dose.
export function TotalChlorineReadingCard({ parameter, chlorineReview, padColor, padPosition }: Props) {
  const readable = parameter && Number.isFinite(parameter.value) && parameter.value >= 0;
  const display = totalChlorinePresentation(parameter);
  const kind = display?.kind;
  const uncertain = Boolean(readable && readingNeedsClarification(parameter));
  const range = parameter?.idealRange;
  const comparisonText = kind && range
    ? `טווח השוואה: \u2066${range.min}–${range.max} ${parameter.unit || 'ppm'}\u2069` : undefined;
  const alternative = parameter?.evidence?.modelCertainty === 'adjacent'
    ? parameter.evidence.alternativeValue : undefined;
  const unit = parameter?.unit || 'ppm';
  const alternativeNote = readable && typeof alternative === 'number' && Number.isFinite(alternative) &&
    alternative >= 0 && alternative !== parameter.value ? `הצבע קרוב גם ל־${formatValue(alternative, unit)}.` : '';
  const valueText = display ? `כ־${formatValue(display.value, unit)}` : 'לא נקרא';
  const reviewNote = chlorineReview?.reason === 'inconsistent'
    ? 'בדוק מחדש את שני סוגי הכלור לפני בחירת טיפול.' : chlorineReview?.reason === 'gap'
      ? 'יש פער לעומת הכלור החופשי. פעל לפי סדר הטיפול שמופיע למעלה.' : '';
  const upperNote = display?.usesUpperCandidate
    ? `לצבע שתי התאמות למקרא: ${formatValue(display.lowerCandidate!, unit)} ו־${formatValue(display.value, unit)}. מוצגת האפשרות הגבוהה; זו הערכה ולא בסיס למינון כלור.` : undefined;

  return (
    <MeasurementCard label="כלור כולל" padColor={padColor} padPosition={padPosition}
      description={MEASUREMENT_COPY.totalChlorine.description} explanation={MEASUREMENT_COPY.totalChlorine.explanation}
      value={valueText}
      status={!readable ? 'חסרה קריאה' : uncertain && !display?.usesUpperCandidate ? 'נדרש צילום חוזר'
        : kind === 'low' ? 'נמוך מהטווח' : kind === 'high' ? 'גבוה מהטווח'
        : kind === 'ok' ? 'בטווח לפי הצילום' : 'אין טווח השוואה'}
      tone={!readable || (uncertain && !display?.usesUpperCandidate) ? 'warning' : kind === 'high' ? 'danger'
        : kind === 'low' ? 'warning' : kind === 'ok' ? 'success' : 'neutral'}
      detail={comparisonText} notice={reviewNote || undefined}
      note={upperNote ?? (uncertain ? 'לא ניתן לקבוע ערך יחיד מההתאמה למקרא. לא נקבע מינון כלור לפי הקריאה הזו.' : alternativeNote || undefined)} />
  );
}
