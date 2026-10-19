import type { ScanResultParameter } from '../domain/scanResults';
import { comparisonKind, readingNeedsClarification, type ChlorineReview } from '../domain/readingComparison';
import type { PadColor } from '../domain/padColor';
import { MeasurementCard } from './MeasurementCard';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';

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
  const kind = readable ? comparisonKind(parameter) : undefined;
  const uncertain = Boolean(readable && readingNeedsClarification(parameter));
  const range = parameter?.idealRange;
  const comparisonText = kind && range
    ? `טווח השוואה: \u2066${range.min}–${range.max} ${parameter.unit || 'ppm'}\u2069` : undefined;
  const alternative = parameter?.evidence?.modelCertainty === 'adjacent'
    ? parameter.evidence.alternativeValue : undefined;
  const unit = parameter?.unit || 'ppm';
  const alternativeNote = readable && typeof alternative === 'number' && Number.isFinite(alternative) &&
    alternative >= 0 && alternative !== parameter.value ? `הצבע קרוב גם ל־${formatValue(alternative, unit)}.` : '';
  const reviewNote = chlorineReview?.reason === 'inconsistent'
    ? 'בדוק מחדש את שני סוגי הכלור לפני בחירת טיפול.' : chlorineReview?.reason === 'gap'
      ? 'יש פער לעומת הכלור החופשי. פעל לפי סדר הטיפול שמופיע למעלה.' : '';

  return (
    <MeasurementCard label="כלור כולל" padColor={padColor} padPosition={padPosition}
      description={MEASUREMENT_COPY.totalChlorine.description} explanation={MEASUREMENT_COPY.totalChlorine.explanation}
      value={readable ? `כ־${formatValue(parameter.value, unit)}` : 'לא נקרא'}
      status={!readable ? 'חסרה קריאה' : uncertain ? 'בין שני טווחים'
        : kind === 'low' ? 'נמוך מהטווח' : kind === 'high' ? 'גבוה מהטווח'
        : kind === 'ok' ? 'בטווח לפי הצילום' : 'אין טווח השוואה'}
      tone={!readable || uncertain ? 'warning' : kind === 'high' ? 'danger'
        : kind === 'low' ? 'warning' : kind === 'ok' ? 'success' : 'neutral'}
      detail={comparisonText} notice={reviewNote || undefined}
      note={alternativeNote || undefined} />
  );
}
