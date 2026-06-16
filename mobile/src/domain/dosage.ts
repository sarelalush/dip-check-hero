// Source of truth migrated from web:
// src/utils/calculateDosage.ts, src/config/productConfig.ts, src/config/targetRanges.ts,
// src/utils/storage.ts, and src/routes/results.$testId.tsx.
//
// PoolCheck treatment spec:
// one active action only, ordered by alkalinity -> pH -> free chlorine -> CYA -> salt -> hardness.
// pH below 7.2 is a safety override and is treated before alkalinity unless alkalinity is high,
// in which case the user receives aeration guidance rather than acid.

import { productConfig, type ProductKey } from '../config/productConfig';
import { targetRanges } from '../config/targetRanges';
import type { Pool } from './pool';
import type { ScanParameterStatusKind, ScanResultParameter, StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';

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
}

const PRIORITY_ORDER: StripParameter[] = ['alkalinity', 'ph', 'freeChlorine', 'cyanuricAcid', 'salt', 'hardness'];
const PH_FLOOR = 7.2;
const TABLET_AVAILABLE_CHLORINE_PCT = 0.9;
const TABLET_DISSOLVE_DAYS = 5;
const TABLET_SAFETY_FACTOR = 0.5;
const RETEST_WINDOW_TEXT = 'המתן 4–6 שעות.';

const DEFAULT_SAFETY_NOTE = 'החישוב הוא הערכה לפי נתוני הבריכה ותוצאת הסטיק. יש לפעול לפי הוראות יצרן חומרי הבריכה, להוסיף חומרים בהדרגה ולא לערבב חומרים שונים יחד.';

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function getTarget(parameter: StripParameter, fallback: number) {
  return targetRanges[parameter]?.target ?? fallback;
}

function getReading(result: StripAnalysisResult, key: StripParameter): ScanResultParameter | undefined {
  return result.parameters.find((parameter) => parameter.key === key);
}

function calcTabletCreditPpm(pool: Pool): number {
  if (!pool.tabletsActive) return 0;
  const count = pool.tabletsCount ?? 1;
  const weight = pool.tabletWeightGrams ?? 200;
  const pumpHoursPerDay = pool.pumpHoursPerDay ?? 8;
  const retestHours = pool.retestHours ?? 6;
  const volumeM3 = pool.volumeLiters / 1000;
  if (volumeM3 <= 0 || pumpHoursPerDay <= 0) return 0;

  const availableChlorineG = weight * TABLET_AVAILABLE_CHLORINE_PCT * count;
  const totalPpm = availableChlorineG / volumeM3;
  const ppmPerPumpHour = totalPpm / (TABLET_DISSOLVE_DAYS * pumpHoursPerDay);
  return ppmPerPumpHour * retestHours * TABLET_SAFETY_FACTOR;
}

function sortByPriority(a: DosageRecommendation, b: DosageRecommendation) {
  const ai = PRIORITY_ORDER.indexOf(a.paramKey);
  const bi = PRIORITY_ORDER.indexOf(b.paramKey);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
}

function baseAction(status: ScanParameterStatusKind) {
  if (status === 'ok') return 'תקין';
  if (status === 'low') return 'נמוך';
  return 'גבוה';
}

function createStatusCard(parameter: ScanResultParameter, exactAmountAvailable: boolean): DosageRecommendation {
  return {
    paramKey: parameter.key,
    labelHe: parameter.name,
    measured: parameter.value,
    target: getTarget(parameter.key, parameter.value),
    unit: parameter.unit,
    status: parameter.status.kind,
    actionHe: baseAction(parameter.status.kind),
    blocked: parameter.status.kind !== 'ok',
    exactAmountAvailable,
  };
}

function buildSteps(firstAction: string, retestHours: number) {
  void retestHours;
  return [
    firstAction,
    'הפעל את משאבת הסחרור והשאר אותה דולקת.',
    RETEST_WINDOW_TEXT,
    'בצע סריקה חדשה של סטיק לבדיקת המצב.',
  ].join('\n');
}

function makeMissingVolumeResult(result: StripAnalysisResult): DosageCalculationResult {
  const recommendations = result.parameters
    .filter((parameter) => PRIORITY_ORDER.includes(parameter.key))
    .map((parameter) => createStatusCard(parameter, false))
    .sort(sortByPriority);
  const firstOffSpec = recommendations.find((recommendation) => recommendation.status !== 'ok');
  const primaryRecommendation = firstOffSpec
    ? {
        ...firstOffSpec,
        active: true,
        blocked: false,
        actionHe: `${firstOffSpec.labelHe} ${baseAction(firstOffSpec.status)}. הזן נפח בריכה כדי לקבל מינון מדויק.`,
      }
    : undefined;

  return {
    recommendations: primaryRecommendation
      ? recommendations.map((recommendation) => (recommendation.paramKey === primaryRecommendation.paramKey ? primaryRecommendation : recommendation))
      : recommendations,
    primaryRecommendation,
    summary: primaryRecommendation?.actionHe ?? 'כל הערכים המרכזיים בטווח. הזן נפח בריכה כדי לקבל המלצות מינון מדויקות בעת הצורך.',
    safetyNote: DEFAULT_SAFETY_NOTE,
    retestNote: 'למינון מדויק צריך נפח בריכה בליטרים.',
    volumeMissing: true,
  };
}

export function calculateDosage(result: StripAnalysisResult, pool?: Pool): DosageCalculationResult {
  if (!pool || pool.volumeLiters <= 0) {
    return makeMissingVolumeResult(result);
  }

  const volumeM3 = pool.volumeLiters / 1000;
  const retestHours = pool.retestHours ?? 6;
  const readings = {
    alkalinity: getReading(result, 'alkalinity'),
    ph: getReading(result, 'ph'),
    freeChlorine: getReading(result, 'freeChlorine'),
    cyanuricAcid: getReading(result, 'cyanuricAcid'),
    salt: getReading(result, 'salt'),
    hardness: getReading(result, 'hardness'),
  } as const;

  const cards = new Map<StripParameter, DosageRecommendation>();
  for (const [key, reading] of Object.entries(readings) as [StripParameter, ScanResultParameter | undefined][]) {
    if (reading) cards.set(key, createStatusCard(reading, true));
  }

  function setActive(key: StripParameter, patch: Partial<DosageRecommendation>) {
    const card = cards.get(key);
    if (!card) return;
    cards.set(key, { ...card, ...patch, active: true, blocked: false, exactAmountAvailable: true });
  }

  const alkalinity = readings.alkalinity;
  const ph = readings.ph;
  const freeChlorine = readings.freeChlorine;
  const phUnsafe = !!ph && ph.value < PH_FLOOR;

  if (ph && phUnsafe) {
    if (alkalinity?.status.kind === 'high') {
      setActive('ph', {
        actionHe: buildSteps('pH נמוך מדי. פתח את משאבת הסחרור ואת המפלים/ג׳טים לאוורור. אל תוסיף חומצה.', retestHours),
      });
    } else {
      const grams = Math.max(100, Math.round((getTarget('ph', ph.value) - ph.value) * volumeM3 * 100));
      setActive('ph', {
        actionHe: buildSteps(`הוסף ${grams} גרם pH Plus ופזר באזורי הסחרור.`, retestHours),
        product: { key: 'phPlus', amount: grams, unit: 'גרם', labelHe: productConfig.phPlus.labelHe },
      });
    }
    return buildResult(cards, retestHours);
  }

  if (alkalinity && alkalinity.status.kind !== 'ok') {
    if (alkalinity.status.kind === 'low') {
      const kg = round1(((getTarget('alkalinity', alkalinity.value) - alkalinity.value) * volumeM3) / 670);
      setActive('alkalinity', {
        actionHe: buildSteps(`פזר ${kg} ק״ג סודה לשתייה (Alkalinity Increaser) באזורי הסחרור.`, retestHours),
        product: { key: 'phPlus', amount: kg * 1000, unit: 'גרם', labelHe: 'Alkalinity Increaser' },
      });
    } else {
      const liters = round1(((alkalinity.value - getTarget('alkalinity', alkalinity.value)) * volumeM3) / 500);
      const portion = round1(liters / 3);
      setActive('alkalinity', {
        actionHe: buildSteps(`הוסף ${portion} ל׳ חומצת מלח 33% לאזורי הסחרור.`, retestHours),
        product: { key: 'acidHCl', amount: portion * 1000, unit: 'מ״ל', labelHe: productConfig.acidHCl.labelHe },
      });
    }
    return buildResult(cards, retestHours);
  }

  if (ph && ph.status.kind !== 'ok') {
    if (ph.status.kind === 'high') {
      const ml = Math.max(50, Math.round(((ph.value - getTarget('ph', ph.value)) * volumeM3) / 20 * 1000));
      setActive('ph', {
        actionHe: buildSteps(`הוסף ${ml} מ״ל חומצת מלח 33% לאזורי הסחרור.`, retestHours),
        product: { key: 'acidHCl', amount: ml, unit: 'מ״ל', labelHe: productConfig.acidHCl.labelHe },
      });
    } else {
      const grams = Math.max(50, Math.round((getTarget('ph', ph.value) - ph.value) * volumeM3 * 100));
      setActive('ph', {
        actionHe: buildSteps(`פזר ${grams} גרם pH Plus באזורי הסחרור.`, retestHours),
        product: { key: 'phPlus', amount: grams, unit: 'גרם', labelHe: productConfig.phPlus.labelHe },
      });
    }
    return buildResult(cards, retestHours);
  }

  if (freeChlorine && freeChlorine.status.kind !== 'ok') {
    if (freeChlorine.status.kind === 'low') {
      let gap = getTarget('freeChlorine', freeChlorine.value) - freeChlorine.value;
      const tabletCredit = calcTabletCreditPpm(pool);
      if (tabletCredit > 0) gap -= tabletCredit;

      if (gap <= 0) {
        setActive('freeChlorine', {
          actionHe: buildSteps('קיימת טבליית כלור פעילה שתשלים את החסר במהלך הסחרור. הפעל סחרור - אין צורך להוסיף כלור נוזלי כעת.', retestHours),
        });
      } else {
        const ml = Math.max(50, Math.round((gap * volumeM3) / 100 * 1000));
        const prefix = tabletCredit > 0
          ? `קיימת טבליית כלור פעילה - ההמלצה הופחתה בהתאם. הוסף ${ml} מ״ל כלור נוזלי 12% לאזורי הסחרור.`
          : `הוסף ${ml} מ״ל כלור נוזלי 12% לאזורי הסחרור.`;
        setActive('freeChlorine', {
          actionHe: buildSteps(prefix, retestHours),
          product: { key: 'chlorineLiquid10', amount: ml, unit: 'מ״ל', labelHe: 'כלור נוזלי 12%' },
        });
      }
    } else {
      const delta = freeChlorine.value - getTarget('freeChlorine', freeChlorine.value);
      if (delta <= 2) {
        setActive('freeChlorine', {
          actionHe: buildSteps('הפעל את משאבת הסחרור - אין צורך להוסיף חומר.', retestHours),
        });
      } else {
        const grams = Math.round(delta * volumeM3);
        setActive('freeChlorine', {
          actionHe: buildSteps(`הוסף ${grams} גרם אנטי-כלור לאזורי הסחרור.`, retestHours),
        });
      }
    }
    return buildResult(cards, retestHours);
  }

  const cya = readings.cyanuricAcid;
  if (cya && cya.status.kind !== 'ok') {
    if (cya.status.kind === 'high') {
      const pct = Math.round(((cya.value - getTarget('cyanuricAcid', cya.value)) / cya.value) * 100);
      setActive('cyanuricAcid', {
        actionHe: buildSteps(`החלף כ-${pct}% מהמים בבריכה (לא לרוקן לחלוטין).`, retestHours),
      });
    } else {
      setActive('cyanuricAcid', {
        actionHe: buildSteps('הוסף Stabilizer (CYA) לפי הוראות היצרן.', retestHours),
      });
    }
    return buildResult(cards, retestHours);
  }

  const salt = readings.salt;
  if (salt && pool.type === 'salt' && salt.status.kind !== 'ok') {
    if (salt.status.kind === 'low') {
      const diff = getTarget('salt', salt.value) - salt.value;
      const kg = round1(diff * productConfig.poolSalt.dosePerPpmPer10kL * (pool.volumeLiters / 10000));
      setActive('salt', {
        actionHe: buildSteps(`פזר ${kg} ק״ג ${productConfig.poolSalt.labelHe} באזורי הסחרור.`, retestHours),
        product: { key: 'poolSalt', amount: kg, unit: 'ק״ג', labelHe: productConfig.poolSalt.labelHe },
      });
    } else {
      const pct = Math.round(((salt.value - getTarget('salt', salt.value)) / salt.value) * 100);
      setActive('salt', {
        actionHe: buildSteps(`החלף כ-${pct}% מהמים בבריכה.`, retestHours),
      });
    }
    return buildResult(cards, retestHours);
  }

  const hardness = readings.hardness;
  if (hardness && hardness.status.kind !== 'ok') {
    if (hardness.status.kind === 'high') {
      const pct = Math.round(((hardness.value - getTarget('hardness', hardness.value)) / hardness.value) * 100);
      setActive('hardness', {
        actionHe: buildSteps(`החלף כ-${pct}% מהמים בבריכה.`, retestHours),
      });
    } else {
      setActive('hardness', {
        actionHe: buildSteps('הוסף Calcium Hardness Increaser לפי הוראות היצרן.', retestHours),
      });
    }
  }

  if (pool.type !== 'salt') cards.delete('salt');
  return buildResult(cards, retestHours);
}

function buildResult(cards: Map<StripParameter, DosageRecommendation>, retestHours: number): DosageCalculationResult {
  void retestHours;
  const recommendations = [...cards.values()].sort(sortByPriority);
  const primaryRecommendation = recommendations.find((recommendation) => recommendation.active);
  return {
    recommendations,
    primaryRecommendation,
    summary: primaryRecommendation?.actionHe ?? 'כל הערכים המרכזיים בטווח. אין צורך להוסיף חומר כרגע.',
    safetyNote: DEFAULT_SAFETY_NOTE,
    retestNote: 'בדיקה חוזרת מומלצת בעוד 4–6 שעות.',
    volumeMissing: false,
  };
}
