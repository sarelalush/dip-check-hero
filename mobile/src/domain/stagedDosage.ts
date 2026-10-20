import { FIXED_DOSING_MATERIALS, productConfig } from '../config/productConfig';
import { calculateDosage, type DosageProduct } from './dosage';
import type { Pool } from './pool';
import { comparisonKind, getChlorineReview, readingNeedsClarification } from './readingComparison';
import type { ScanResultParameter, StripAnalysisResult } from './scanResults';

// Sources and concentration assumptions are documented in docs/staged-dosing.md.
// This is one maintenance portion, never a shock treatment or swim clearance.
// A new result recalculates the remaining correction; there are no saved thirds.
const PORTION_DIVISOR = 3;
export const STAGED_DOSING_LEGAL_VERSION = '2026-10-20.3';
const MAX_RESULT_AGE_MS = 30 * 60 * 1000;
const ML_PER_US_QUART = 946.352946;
const LITERS_PER_10000_US_GALLONS = 37854.11784;
const HCL_MOLAR_MASS = 36.46;
const CACO3_EQUIVALENT_MASS = 50.043;
// Use the upper end of the 33% HCl SDS density range to round the volume down.
const ACID_DENSITY_GRAMS_PER_ML = 1.17;
// HASA's routine 31.45% HCl increment: one US quart / 20,000 US gal /24h.
// Convert by HCl mass to 33%, then take at most one third as an opening portion.
// This app adaptation is not a prediction of final pH or a universal label.
const ROUTINE_ACID_REFERENCE_FRACTION = 0.3145;
const ROUTINE_ACID_REFERENCE_DENSITY = 1.16;
const ROUTINE_ACID_REFERENCE_LITERS = 2 * LITERS_PER_10000_US_GALLONS;
const GRAMS_PER_POUND = 453.59237;

export interface StagedDoseOptions {
  now: number;
  historical?: boolean;
  latestTreatmentAt?: number;
  latestDoseRetestNotBefore?: number;
  latestTreatmentRequiresDpdFollowUp?: boolean;
  latestDpdFollowUpAt?: number;
  waterTestIsCurrent?: boolean;
}

export interface StagedDosePlan {
  product?: DosageProduct;
  steps?: string[];
  reason?: string;
  materialNote?: string;
  calculationNote?: string;
  needsCurrentWaterConfirmation?: boolean;
  retestMinimumHours?: number;
  prerequisiteHe?: string;
}

function readingValues(parameter: ScanResultParameter): number[] | undefined {
  if (!Number.isFinite(parameter.value) || parameter.value < 0 || readingNeedsClarification(parameter)) return undefined;
  const values = [parameter.value];
  if (parameter.evidence?.modelCertainty === 'adjacent') {
    const alternative = parameter.evidence.alternativeValue;
    if (typeof alternative !== 'number' || !Number.isFinite(alternative) || alternative < 0) return undefined;
    values.push(alternative);
  }
  return values;
}

function roundDown(value: number, increment: number): number {
  return Math.floor(value / increment) * increment;
}

function calculatePortionWithContext(result: StripAnalysisResult, pool: Pool | undefined,
  options: StagedDoseOptions, purpose: 'current-treatment' | 'saved-reading-review'): StagedDosePlan {
  const currentTreatment = purpose === 'current-treatment';
  const dosage = calculateDosage(result, pool);
  const primary = dosage.primaryRecommendation;
  if (!primary || primary.status === 'ok') return {};
  const acid = (primary.paramKey === 'ph' && primary.status === 'high') ||
    (primary.paramKey === 'alkalinity' && primary.status === 'high');
  const supported = acid || (primary.paramKey === 'alkalinity' && primary.status === 'low') ||
    (primary.paramKey === 'freeChlorine' && primary.status === 'low') ||
    (primary.paramKey === 'ph' && primary.status === 'low');
  if (!supported) return {};
  if (currentTreatment && options.latestTreatmentRequiresDpdFollowUp)
    return { reason: 'לאחר טיפול השוק נדרשת מדידת DPD חוזרת לפני חישוב מנת תחזוקה.' };
  if (currentTreatment && typeof options.latestDpdFollowUpAt === 'number' &&
      result.analyzedAt <= options.latestDpdFollowUpAt)
    return { reason: 'בצע בדיקה חדשה אחרי מדידת ה־DPD החוזרת לפני חישוב מנת תחזוקה.' };
  if (currentTreatment && options.historical) return { reason: 'ההנחיות מהבדיקה השמורה מוצגות לעיון. מנה לביצוע מחושבת מבדיקה עדכנית.' };
  if (currentTreatment && (!Number.isFinite(options.now) || !Number.isFinite(result.analyzedAt) ||
      result.analyzedAt > options.now || options.now - result.analyzedAt > MAX_RESULT_AGE_MS))
    return { reason: 'עבר זמן מאז הניתוח. בצע בדיקה חדשה לפני חישוב כמות.' };
  if (result.source === 'mock' || result.source === 'remote-mock' ||
      (currentTreatment ? result.accepted !== true || result.isValidStrip !== true
        : result.accepted === false || result.isValidStrip === false))
    return { reason: 'כמות מוצגת רק לבדיקה שהושלמה והתקבלה.' };
  if (currentTreatment && Number.isFinite(options.latestTreatmentAt) && options.latestTreatmentAt! >= result.analyzedAt)
    return { reason: 'כבר תועד טיפול אחרי בדיקה זו. בצע בדיקה חדשה לפני הוספת חומר נוסף.' };
  if (currentTreatment && typeof options.latestDoseRetestNotBefore === 'number' && Number.isFinite(options.latestDoseRetestNotBefore) &&
      (options.now < options.latestDoseRetestNotBefore || result.analyzedAt < options.latestDoseRetestNotBefore))
    return { reason: 'טרם הושלמה ההמתנה שנקבעה למנה הקודמת. בצע בדיקה חדשה אחרי זמן ההמתנה ולפי התווית.' };
  if (!pool || dosage.volumeMissing) return { reason: 'השלם את נפח הבריכה כדי לחשב כמות.' };
  if ((currentTreatment && !result.poolId) || (result.poolId && ![pool.id, pool.cloudId].includes(result.poolId)))
    return { reason: 'יש לשייך את הבדיקה לבריכה הנכונה לפני חישוב כמות.' };

  const find = (key: ScanResultParameter['key']) => result.parameters.find(parameter => parameter.key === key);
  const measured = find(primary.paramKey);
  const ph = find('ph');
  const ta = find('alkalinity');
  const fc = find('freeChlorine');
  if (!measured || !ph || !ta || !fc || [ph, ta, fc].some(parameter =>
    !Number.isFinite(parameter.value) || parameter.value < 0 || comparisonKind(parameter) === undefined)) return {};
  const values = readingValues(measured);
  const phValues = readingValues(ph);
  if (!values || !phValues) return { reason: 'הקריאה בין טווחים שמשנים את הטיפול. בדוק שוב את המדד לפני חישוב כמות.' };
  const minPh = Math.min(...phValues);
  const maxPh = Math.max(...phValues);
  const fcValues = readingValues(fc);
  if (minPh < 6.8 || maxPh > 8.4 || !fcValues || Math.max(...fcValues) > 10)
    return { reason: 'המדדים מחוץ לתחום החישוב הזה. קבל בדיקה והנחיית טיפול מותאמות.' };
  if (getChlorineReview(result.parameters) && primary.paramKey === 'freeChlorine')
    return { reason: 'הפער בין קריאות הכלור דורש טיפול נפרד; אין לחשב אותו כמנת תחזוקה.' };
  if (result.parameters.some(parameter => parameter.key === 'cyanuricAcid' &&
      (comparisonKind(parameter) !== 'ok' || readingNeedsClarification(parameter))))
    return { reason: 'יש להתאים את הטיפול גם למייצב שמחוץ לטווח לפני חישוב כמות.' };

  // A newly analysed gallery image does not prove a newly sampled pool.
  const dippedAt = result.captureMetadata?.dippedAt;
  const timedCurrentTest = typeof dippedAt === 'number' && Number.isFinite(dippedAt) &&
    dippedAt <= result.analyzedAt && dippedAt <= options.now && options.now - dippedAt <= MAX_RESULT_AGE_MS &&
    (!Number.isFinite(options.latestTreatmentAt) || dippedAt > options.latestTreatmentAt!) &&
    (!Number.isFinite(options.latestDoseRetestNotBefore) || dippedAt >= options.latestDoseRetestNotBefore!);
  if (currentTreatment && !timedCurrentTest && !options.waterTestIsCurrent)
    return { reason: 'הכמות מיועדת למים שנבדקו עכשיו, לפני הוספת חומרים.', needsCurrentWaterConfirmation: true };

  let product: DosageProduct;
  let materialNote: string;
  let calculationNote: string;
  let retestMinimumHours: number | undefined;
  let prerequisiteHe: string | undefined;
  const volumeM3 = pool.volumeLiters / 1000;
  if (acid) {
    const taValues = readingValues(ta);
    if (!taValues || Math.min(...taValues) < 80 || minPh <= 7.4) {
      const reason = !taValues ? 'קריאת האלקליניות אינה ברורה מספיק לחישוב חומצה.'
        : minPh <= 7.4 ? `ה־pH בבדיקה הוא ${minPh.toLocaleString('he-IL')}. בחישוב הזה אין מנת חומצה כשה־pH הוא 7.4 ומטה, כי החומצה מורידה גם אותו.`
        : `האלקליניות בבדיקה היא ${Math.min(...taValues).toLocaleString('he-IL')} ppm, מתחת ל־80. בחישוב הזה אין מנת חומצה למצב זה.`;
      return { reason,
        steps: ['אל תוסיף כעת חומצה לפי תוצאה זו.', 'בדוק pH ואלקליניות בערכה מתאימה לקבלת כמות מותאמת.', 'בחר טיפול לפי הבדיקה העדכנית.'] };
    }
    // Do not infer total acid demand by multiplying a pH difference by volume.
    // Supply a bounded routine opening portion and recalculate after retesting.
    const acidPerPpmMl = volumeM3 * HCL_MOLAR_MASS /
      (CACO3_EQUIVALENT_MASS * FIXED_DOSING_MATERIALS.acid.massFractionHCl * ACID_DENSITY_GRAMS_PER_ML);
    const alkalinityHeadroom = Math.max(0, Math.min(...taValues) - 80);
    const taCorrection = Math.max(0, Math.min(...taValues) - 100);
    const routineAcidMl = pool.volumeLiters / ROUTINE_ACID_REFERENCE_LITERS * ML_PER_US_QUART *
      (ROUTINE_ACID_REFERENCE_FRACTION * ROUTINE_ACID_REFERENCE_DENSITY) /
      (FIXED_DOSING_MATERIALS.acid.massFractionHCl * ACID_DENSITY_GRAMS_PER_ML);
    const amount = roundDown(Math.min(routineAcidMl / PORTION_DIVISOR,
      alkalinityHeadroom * acidPerPpmMl / PORTION_DIVISOR,
      primary.paramKey === 'alkalinity' ? taCorrection * acidPerPpmMl / PORTION_DIVISOR : Infinity), 5);
    if (amount <= 0) return { reason: 'המנה קטנה מ־5 מ״ל או שאין מרווח באלקליניות. אל תעגל למעלה; קבל הנחיית מינון מותאמת.' };
    product = { key: 'acidHCl', amount, unit: 'מ״ל', labelHe: FIXED_DOSING_MATERIALS.acid.labelHe };
    materialNote = FIXED_DOSING_MATERIALS.acid.requirementHe;
    calculationNote = 'מנת פתיחה לפי נפח הבריכה: עד שליש ממנת תחזוקה שפורסמה לחומצה 31.45%, לאחר המרה לפי מסת החומר הפעיל לחומצה 33%. הכמות מוגבלת גם לפי האלקליניות ומעוגלת כלפי מטה. זו אינה כמות התיקון המלאה ואינה תחזית ל־pH הסופי.';
    retestMinimumHours = 24;
  } else if (primary.paramKey === 'ph') {
    const taValues = readingValues(ta);
    if (!taValues || Math.min(...taValues) < 80 || Math.max(...taValues) > 120)
      return { reason: 'לכמות מעלה pH נדרשת אלקליניות בטווח 80–120 ppm. כעת צריך להתאים את הטיפול גם לאלקליניות.',
        steps: primary.actionHe.split('\n').filter(Boolean) };
    // The published 99% sodium carbonate label uses 1/2 lb per10,000 US gal
    // at pH6.8–7.2. Use one third of that opening increment; no promised pH rise.
    const portionGrams = (GRAMS_PER_POUND / 2) * 0.99 * pool.volumeLiters /
      LITERS_PER_10000_US_GALLONS / PORTION_DIVISOR;
    const amount = roundDown(portionGrams, 5);
    if (amount <= 0) return { reason: 'המנה קטנה מ־5 גרם. אל תעגל אותה למעלה; קבל הנחיית מינון מותאמת.' };
    product = { key: 'phPlus', amount, unit: 'גרם', labelHe: FIXED_DOSING_MATERIALS.phPlus.labelHe };
    materialNote = FIXED_DOSING_MATERIALS.phPlus.requirementHe;
    calculationNote = 'מנת פתיחה ל־pH נמוך לפי נפח הבריכה: שליש ממנת תחזוקה שפורסמה לנתרן פחמתי 99%, כשהאלקליניות בטווח ההשוואה, ובעיגול כלפי מטה. החומר יכול להעלות גם אלקליניות; בבדיקה הבאה נבחר טיפול מחדש. אין חישוב לינארי מהפרש ה־pH ואין התחייבות לערך סופי.';
    retestMinimumHours = 24;
  } else if (primary.paramKey === 'freeChlorine') {
    if (minPh < 7.2 || maxPh > 7.6) return { reason: 'יש להסדיר תחילה את ה־pH לפני מנת הכלור.' };
    const deficit = Math.max(0, Math.min(primary.target, 2) - Math.max(...values));
    // ppm * litres / (g/L) gives mL. Do not subtract predicted tablet output.
    const amount = roundDown(deficit * pool.volumeLiters /
      FIXED_DOSING_MATERIALS.chlorine.availableChlorineGramsPerLiter / PORTION_DIVISOR, 5);
    if (amount <= 0) return { reason: 'המנה קטנה מ־5 מ״ל. אל תעגל אותה למעלה; פעל לפי מינון התווית.' };
    product = { key: 'chlorineLiquid10', amount, unit: 'מ״ל', labelHe: FIXED_DOSING_MATERIALS.chlorine.labelHe };
    materialNote = FIXED_DOSING_MATERIALS.chlorine.requirementHe;
    calculationNote = 'שליש מההשלמה המחושבת ל־2 ppm כלור חופשי, מעוגל כלפי מטה. זו מנת תחזוקה; אינה טיפול שוק ואינה מבטיחה שהדרישה לכלור סופקה.';
  } else {
    if (Math.min(...values) <= 50)
      prerequisiteHe = 'באלקליניות של 50 ppm ומטה, בדוק תחילה מתכות מומסות במים וקבל טיפול מתאים אם נמצאו. אין להוסיף את החומר לפני הבירור הזה.';
    const deficit = Math.max(0, Math.min(primary.target, 100) - Math.max(...values));
    // 84.007 / 50.043 g NaHCO3 per g CaCO3 equivalent. Use 100% activity
    // (the stronger end of 99–100%) and round down, without a minimum dose.
    const amount = roundDown(Math.min(deficit / PORTION_DIVISOR, 50 / PORTION_DIVISOR) *
      volumeM3 * 84.007 / CACO3_EQUIVALENT_MASS, 5);
    if (amount <= 0) return { reason: 'המנה קטנה מ־5 גרם. אל תעגל אותה למעלה; פעל לפי מינון התווית.' };
    product = { key: 'sodiumBicarbonate', amount, unit: 'גרם', labelHe: productConfig.sodiumBicarbonate.labelHe };
    materialNote = 'נתרן ביקרבונט (NaHCO₃) לבריכות, 99%–100%. אינו סודה קאוסטית ואינו סודה אש / pH Plus.';
    calculationNote = 'שליש מההשלמה המחושבת ל־100 ppm, מעוגל כלפי מטה. אין להשתמש בחישוב לתערובת של חומרים.';
    retestMinimumHours = 24;
  }
  const amountHe = product.amount.toLocaleString('he-IL');
  return { product, materialNote, calculationNote, prerequisiteHe, retestMinimumHours,
    steps: [
      `הוסף ${amountHe} ${product.unit} ${product.labelHe}, לפי אופן ההוספה שבתווית וללא רוחצים.`,
      'הפעל סחרור לפי הוראות המוצר והמערכת. אין לערבב חומרים.',
      retestMinimumHours
        ? `לפני מנה נוספת, המתן לפחות ${retestMinimumHours} שעות, או יותר אם התווית דורשת.`
        : 'המתן לזמן הבדיקה החוזרת שנקבע בתווית המוצר; אין להסיק מזמן ההמתנה שמותר להתרחץ.',
      'בצע בדיקה חדשה. אל תוסיף מנה נוספת לפי התוצאה הזו.',
    ],
  };
}

// Current execution eligibility is never relaxed when reading an older result.
export function buildStagedDose(result: StripAnalysisResult, pool: Pool | undefined, options: StagedDoseOptions): StagedDosePlan {
  return calculatePortionWithContext(result, pool, options, 'current-treatment');
}
