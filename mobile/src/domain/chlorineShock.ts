import { FIXED_DOSING_MATERIALS } from '../config/productConfig';
import type { Pool } from './pool';
import type { SavedTreatmentPlan } from './savedTreatmentPlan';
import type { StripAnalysisResult } from './scanResults';

// Separate from staged maintenance. Never derive these inputs from a strip,
// subtract predicted tablet output, or divide breakpoint treatment into thirds.
// CDC / Indiana DOH: target FC = 10 * (TC - FC); add only the remaining deficit.
export const SHOCK_POLICY_VERSION = 'manual-dpd-breakpoint-2026-10-20';
export const SHOCK_INPUT_MAX_AGE_MS = 30 * 60 * 1000;

export interface DpdReading {
  freeChlorine: number;
  totalChlorine: number;
  ph: number;
  cyanuricAcid: number;
  measuredAt: number;
}

export interface DpdShockSnapshot extends DpdReading {
  source: 'manual-dpd';
  targetFreeChlorine: number;
  productAndEquipmentConfirmed: true;
  disclosureVersion: typeof SHOCK_POLICY_VERSION;
}

export function parseDpdNumber(text: string): number | undefined {
  const normalized = text.trim().replace(',', '.');
  // Empty, exponent notation, pasted units and signed values are not readings.
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

export function dpdReadingIssue(reading: DpdReading): string | undefined {
  if (![reading.freeChlorine, reading.totalChlorine, reading.ph, reading.cyanuricAcid, reading.measuredAt]
    .every(Number.isFinite) || reading.freeChlorine < 0 || reading.totalChlorine < 0 || reading.cyanuricAcid < 0)
    return 'הזן את כל המדדים כמספרים, לפי בדיקה עדכנית.';
  if (reading.totalChlorine < reading.freeChlorine)
    return 'כלור כולל אינו יכול להיות נמוך מכלור חופשי. בדוק את ההזנה ואת הערכה.';
  // Conservative scope of this calculator, not universal treatment/operating limits.
  if (reading.ph < 7.2 || reading.ph > 7.6)
    return 'חישוב השוק הזה דורש pH בטווח 7.2–7.6. הסדר תחילה את ה־pH ובדוק שוב.';
  if (reading.cyanuricAcid > 50 || reading.freeChlorine > 10)
    return 'המדדים מחוץ לתחום מחשבון השוק הזה. נדרשת הנחיית טיפול מותאמת.';
  return undefined;
}

export function shockCalculation(reading: DpdReading, volumeLiters: number): {
  target?: number; amountMl?: number; reason?: string;
} {
  const issue = dpdReadingIssue(reading);
  if (issue) return { reason: issue };
  if (!Number.isFinite(volumeLiters) || volumeLiters < 1000)
    return { reason: 'השלם נפח בריכה של 1,000 ליטר ומעלה כדי להשתמש במחשבון הזה.' };
  const combined = reading.totalChlorine - reading.freeChlorine;
  if (combined <= 0.4 + 1e-6)
    return { reason: 'לפי מדידת ה־DPD, אין פער שמצריך טיפול שוק במחשבון הזה. אין להוסיף מנת שוק לפי הצילום.' };
  const target = combined * 10;
  if (target > 20 + 1e-6)
    return { reason: 'יעד השוק המחושב גבוה מ־20 ppm, מעבר לתחום המחשבון. קבל טיפול מותאם; אין להקטין את המנה לשליש.' };
  const deficit = target - reading.freeChlorine;
  if (deficit <= 0)
    return { reason: 'הכלור החופשי כבר מגיע ליעד המחושב. אין להוסיף מנת שוק נוספת; נדרשת בדיקה והנחיה מותאמות.' };
  // ppm * L / (g/L) -> mL. Round UP by less than 1mL, never below breakpoint.
  const amountMl = Math.ceil(Number((deficit * volumeLiters /
    FIXED_DOSING_MATERIALS.chlorine.availableChlorineGramsPerLiter).toFixed(8)));
  if (!Number.isSafeInteger(amountMl) || amountMl <= 0)
    return { reason: 'לא ניתן לחשב כמות מהנתונים שהוזנו.' };
  return { target, amountMl };
}

export function buildShockPlan(result: StripAnalysisResult, pool: Pool, reading: DpdReading,
  productAndEquipmentConfirmed: boolean): { plan?: SavedTreatmentPlan; reason?: string } {
  if (result.source === 'mock' || result.source === 'remote-mock')
    return { reason: 'אין לחשב טיפול לבריכה לפי רשומת הדגמה.' };
  const calculation = shockCalculation(reading, pool.volumeLiters);
  if (!calculation.amountMl || calculation.target === undefined) return { reason: calculation.reason };
  if (!productAndEquipmentConfirmed) return { reason: 'אשר התאמה של החומר, התווית והציוד לנתונים וליעד המוצג.' };
  if (!result.poolId || ![pool.id, pool.cloudId].includes(result.poolId))
    return { reason: 'שייך את הבדיקה לבריכה הנכונה לפני חישוב.' };
  const amount = calculation.amountMl;
  return { plan: {
    schemaVersion: 1, resultId: result.id, analyzedAt: result.analyzedAt, proposedAt: reading.measuredAt,
    poolId: result.poolId, volumeLiters: pool.volumeLiters, paramKey: 'totalChlorine', labelHe: 'כלור קשור — טיפול שוק',
    product: { key: 'chlorineLiquid10', amount, unit: 'מ״ל', labelHe: FIXED_DOSING_MATERIALS.chlorine.labelHe },
    shock: { ...reading, source: 'manual-dpd', targetFreeChlorine: calculation.target,
      productAndEquipmentConfirmed: true, disclosureVersion: SHOCK_POLICY_VERSION },
    policyVersion: SHOCK_POLICY_VERSION,
    materialNote: FIXED_DOSING_MATERIALS.chlorine.requirementHe,
    calculationNote: `לפי מדידת DPD שהוזנה בנפרד מהצילום: יעד כלור חופשי הוא פי 10 מהפרש הכלור הכולל והחופשי (${calculation.target.toLocaleString('he-IL')} ppm). הכמות משלימה מהכלור החופשי שנמדד ליעד, לפי הנפח וריכוז 120 גרם לליטר, בעיגול כלפי מעלה של פחות ממ״ל אחד. זו מנה מלאה לחישוב הזה, ללא חלוקה לשליש. הביקוש בפועל לכלור עשוי להיות שונה; נדרשת מדידה חוזרת מתאימה, ואין התחייבות שהיעד יושג.`,
    steps: [
      `הוסף ${amount.toLocaleString('he-IL')} מ״ל כלור נוזלי 12% (120 גרם כלור פעיל לליטר), לפי אופן ההוספה שבתווית וללא רוחצים.`,
      'הפעל סחרור ואוורור לפי הוראות המוצר והמערכת. אין לערבב כלור עם חומצה או עם חומר אחר.',
      'לאחר זמן הטיפול וההמתנה שבתווית, מדוד שוב כלור חופשי, כולל ו־pH בערכה המתאימה גם לריכוזי שוק. אל תוסיף שוב לפי המדידה הזו.',
      'חזרה לרחצה רק לאחר מדידה מתאימה ועמידה בדרישות המוצר והמערכת. הכמות או זמן ההמתנה אינם אישור רחצה.',
    ],
  } };
}

export function shockPlanCurrentIssue(plan: SavedTreatmentPlan, pool: Pool | undefined, now: number,
  latestTreatmentAt?: number, latestDoseRetestNotBefore?: number): string | undefined {
  if (!plan.shock) return 'אין מדידת DPD שמורה לחישוב הזה.';
  if (!pool || !plan.poolId || ![pool.id, pool.cloudId].includes(plan.poolId) || pool.volumeLiters !== plan.volumeLiters)
    return 'נפח הבריכה או השיוך השתנו. הכמות השמורה מיועדת לעיון בלבד.';
  if (!Number.isFinite(now) || plan.shock.measuredAt > now || now - plan.shock.measuredAt > SHOCK_INPUT_MAX_AGE_MS)
    return 'הכמות נשמרה לתיעוד. עבר זמן מהמדידה; נדרשת בדיקה עדכנית לפני טיפול.';
  if (typeof latestTreatmentAt === 'number' && latestTreatmentAt >= plan.shock.measuredAt)
    return 'תועד טיפול אחרי המדידה. אין להוסיף כמות נוספת לפי אותה מדידה.';
  if (typeof latestDoseRetestNotBefore === 'number' &&
    (now < latestDoseRetestNotBefore || plan.shock.measuredAt < latestDoseRetestNotBefore))
    return 'טרם הסתיימה ההמתנה לטיפול הקודם. נדרשת מדידה חדשה לאחר זמן ההמתנה.';
  return undefined;
}

export function dpdFollowUpIssue(reading: DpdReading): string | undefined {
  const issue = dpdReadingIssue(reading);
  if (issue) return issue;
  const minimum = reading.cyanuricAcid > 0 ? 2 : 1;
  if (reading.freeChlorine < minimum || reading.freeChlorine > 3 ||
      reading.totalChlorine - reading.freeChlorine > 0.4 + 1e-6)
    return 'המדדים עדיין מחוץ לתחום החזרה לתחזוקה במחשבון. אין לחזור על מנת השוק; קבל הנחיית המשך מותאמת.';
  return undefined;
}
