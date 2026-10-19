import type { ScanResultParameter } from '../domain/scanResults';
import type { ChlorineReview } from '../domain/readingComparison';
import type { PadColor } from '../domain/padColor';
import { MeasurementCard } from './MeasurementCard';

interface Props {
  parameter?: ScanResultParameter;
  chlorineReview?: ChlorineReview;
  padColor?: PadColor;
}

function formatValue(value: number, unit: string) {
  return `\u2066${value.toLocaleString('he-IL', { maximumFractionDigits: 1 })} ${unit}\u2069`;
}

// Total chlorine stays a measurement, with a pairwise review warning rather
// than a borrowed free-chlorine target or an automatic treatment instruction.
export function TotalChlorineReadingCard({ parameter, chlorineReview, padColor }: Props) {
  const readable = parameter && Number.isFinite(parameter.value) && parameter.value >= 0;
  const alternative = parameter?.evidence?.modelCertainty === 'adjacent'
    ? parameter.evidence.alternativeValue : undefined;
  const unit = parameter?.unit || 'ppm';
  const alternativeNote = readable && typeof alternative === 'number' && Number.isFinite(alternative) &&
    alternative >= 0 && alternative !== parameter.value ? `הצבע קרוב גם ל־${formatValue(alternative, unit)}.` : '';
  const reviewNote = chlorineReview?.reason === 'inconsistent'
    ? 'בדוק מחדש את שני סוגי הכלור לפני בחירת טיפול.' : chlorineReview?.reason === 'gap'
      ? 'לכלור קשור גבוה, כיוון התיקון הוא טיפול שוק מתאים. פעל לפי סדר הטיפול שמופיע למעלה.' : '';

  return (
    <MeasurementCard label="כלור כולל" padColor={padColor}
      value={readable ? `כ־${formatValue(parameter.value, unit)}` : 'לא נקרא'}
      status={!readable ? 'חסרה קריאה' : chlorineReview?.reason === 'gap'
        ? 'חשד לכלור קשור' : chlorineReview ? 'קריאות סותרות' : 'הערכה מצילום'}
      tone={!readable || chlorineReview ? 'warning' : 'neutral'}
      detail="כלור חופשי + כלור קשור"
      note={[reviewNote, alternativeNote].filter(Boolean).join(' ') || undefined} />
  );
}
