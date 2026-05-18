import type { StripResults, StripReading } from "./analyzeStripImage";
import { productConfig, type ProductKey } from "@/config/productConfig";
import { targetRanges } from "@/config/targetRanges";
import type { Pool } from "./storage";

export interface DosageRecommendation {
  paramKey: string;
  labelHe: string;
  measured: number;
  target: number;
  unit: string;
  status: "low" | "ok" | "high";
  /** Hebrew, user-friendly recommendation. */
  actionHe: string;
  product?: { key: ProductKey; amount: number; unit: string; labelHe: string };
  /** True when treatment is deferred because a higher-priority parameter is off. */
  blocked?: boolean;
}

/**
 * Treatment-order priority for pool chemistry:
 *   1. Alkalinity (buffers pH; treat first)
 *   2. pH         (only after TA is balanced)
 *   3. Free Chlorine (effectiveness depends on pH)
 *   4. CYA / salt / hardness
 *
 * We emit ONE active action at a time — lower-priority parameters are not
 * even evaluated until the higher-priority one is in range.
 */
const PRIORITY_ORDER = [
  "alkalinity", "ph", "freeChlorine", "cyanuricAcid", "salt", "hardness",
] as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function getReading(results: StripResults, key: string): StripReading | undefined {
  // @ts-expect-error dynamic key (back-compat shortcuts + readings map)
  return results[key] ?? results.readings?.[key];
}

const sortByPriority = (a: DosageRecommendation, b: DosageRecommendation) => {
  const ai = PRIORITY_ORDER.indexOf(a.paramKey as typeof PRIORITY_ORDER[number]);
  const bi = PRIORITY_ORDER.indexOf(b.paramKey as typeof PRIORITY_ORDER[number]);
  return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
};

export function calculateDosage(
  results: StripResults,
  pool: Pool,
): DosageRecommendation[] {
  const volumeM3 = pool.volumeLiters / 1000;
  const out: DosageRecommendation[] = [];

  const alk = getReading(results, "alkalinity");
  const ph = getReading(results, "ph");
  const fc = getReading(results, "freeChlorine");

  const alkRange = targetRanges.alkalinity;
  const phRange = targetRanges.ph;
  const fcRange = targetRanges.freeChlorine;

  const okRec = (
    key: string, r: StripReading, range: { target: number }, msg: string,
  ): DosageRecommendation => ({
    paramKey: key, labelHe: r.labelHe, measured: r.value, target: range.target,
    unit: r.unit, status: "ok", actionHe: msg,
  });

  let primaryBalanced = true;

  // ──────────────────── 1. ALKALINITY ────────────────────
  if (alk && alk.status !== "ok") {
    primaryBalanced = false;

    if (alk.status === "low") {
      const delta = alkRange.target - alk.value;
      const kg = round1((delta * volumeM3) / 670);
      out.push({
        paramKey: "alkalinity", labelHe: alk.labelHe, measured: alk.value,
        target: alkRange.target, unit: alk.unit, status: "low",
        actionHe: `האלקליניות נמוכה. הוסף כ־${kg} ק״ג סודה לשתייה (Alkalinity Increaser) בהדרגה, הפעל סחרור, ובדוק שוב לפני שממשיכים לטפל ב־pH או בכלור.`,
        product: { key: "phPlus", amount: kg * 1000, unit: "גרם", labelHe: "Alkalinity Increaser (סודה לשתייה)" },
      });
    } else {
      // alk.status === "high".
      // Acid lowers BOTH alkalinity AND pH. If pH is already low/at the floor,
      // we must NOT add acid — switch to fixing pH first (aerate raises pH
      // without raising TA).
      const phAlreadyLow = ph && (ph.status === "low" || ph.value <= 7.3);

      if (phAlreadyLow) {
        out.push({
          paramKey: "ph", labelHe: ph!.labelHe, measured: ph!.value,
          target: phRange.target, unit: ph!.unit, status: ph!.status,
          actionHe: "האלקליניות גבוהה, אבל ה־pH כבר נמוך — אסור להוסיף חומצה כרגע. קודם להעלות pH באמצעות אוורור (סחרור, מפלים, ג׳טים), ורק כשה־pH יציב נחזור לטפל באלקליניות.",
        });
      } else {
        const delta = alk.value - alkRange.target;
        const liters = round1((delta * volumeM3) / 500);
        const portion = round1(liters / 3);
        out.push({
          paramKey: "alkalinity", labelHe: alk.labelHe, measured: alk.value,
          target: alkRange.target, unit: alk.unit, status: "high",
          actionHe: `האלקליניות גבוהה. סה״כ כ־${liters} ליטר חומצת מלח 33% — הוסף בהדרגה כ־${portion} ליטר בכל פעם, הפעל סחרור, ובדוק שוב pH ואלקליניות. שים לב: החומצה מורידה גם את ה־pH. אם ה־pH יורד מתחת ל־7.2, עצור את הטיפול באלקליניות ועבור להעלאת pH (אוורור) לפני המשך.`,
          product: { key: "acidHCl", amount: liters * 1000, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
        });
      }
    }
  } else if (alk) {
    out.push(okRec("alkalinity", alk, alkRange, "אלקליניות תקינה."));
  }

  // ──────────────────── 2. pH ────────────────────
  // Evaluated ONLY if alkalinity is balanced.
  if (primaryBalanced && ph) {
    if (ph.status === "ok") {
      out.push(okRec("ph", ph, phRange, "ה־pH תקין."));
    } else {
      primaryBalanced = false;
      if (ph.status === "high") {
        const delta = ph.value - phRange.target;
        const liters = round1((delta * volumeM3) / 20);
        const ml = Math.max(50, Math.round(liters * 1000));
        out.push({
          paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
          target: phRange.target, unit: ph.unit, status: "high",
          actionHe: `ה־pH גבוה. הוסף כ־${ml} מ״ל חומצת מלח 33% בהדרגה, הפעל סחרור, ובדוק שוב לפני המשך.`,
          product: { key: "acidHCl", amount: ml, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
        });
      } else {
        const delta = phRange.target - ph.value;
        const grams = Math.max(50, Math.round(delta * volumeM3 * 100));
        out.push({
          paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
          target: phRange.target, unit: ph.unit, status: "low",
          actionHe: `ה־pH נמוך. הוסף כ־${grams} גרם pH Plus (סודה אש) בהדרגה, הפעל סחרור, ובדוק שוב.`,
          product: { key: "phPlus", amount: grams, unit: "גרם", labelHe: productConfig.phPlus.labelHe },
        });
      }
    }
  }

  // ──────────────────── 3. FREE CHLORINE ────────────────────
  // Evaluated ONLY if alkalinity AND pH are both balanced.
  if (primaryBalanced && fc) {
    if (fc.status === "ok") {
      out.push(okRec("freeChlorine", fc, fcRange, "רמת הכלור תקינה."));
    } else if (fc.status === "low") {
      const delta = fcRange.target - fc.value;
      const liters = (delta * volumeM3) / 100;
      const ml = Math.max(50, Math.round(liters * 1000));
      out.push({
        paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
        target: fcRange.target, unit: fc.unit, status: "low",
        actionHe: `רמת הכלור נמוכה. הוסף כ־${ml} מ״ל כלור נוזלי 12%, הפעל סחרור ובדוק שוב.`,
        product: { key: "chlorineLiquid10", amount: ml, unit: "מ״ל", labelHe: "כלור נוזלי 12%" },
      });
      primaryBalanced = false;
    } else {
      const delta = fc.value - fcRange.target;
      if (delta <= 2) {
        out.push({
          paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
          target: fcRange.target, unit: fc.unit, status: "high",
          actionHe: "רמת הכלור מעט גבוהה. מומלץ להמתין מספר שעות, להפעיל סחרור, ולבדוק שוב לפני כל פעולה.",
        });
      } else {
        const grams = Math.round(delta * volumeM3);
        out.push({
          paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
          target: fcRange.target, unit: fc.unit, status: "high",
          actionHe: `רמת הכלור גבוהה משמעותית. ניתן להוסיף כ־${grams} גרם אנטי־כלור (Sodium Thiosulfate), או להמתין ולסחרר ולבדוק שוב.`,
        });
      }
      primaryBalanced = false;
    }
  }

  // ──────────────────── 4. SECONDARY (CYA / salt / hardness) ────────────────────
  // Only surfaced once ALL primaries are balanced.
  if (!primaryBalanced) {
    return out.sort(sortByPriority);
  }

  const cya = getReading(results, "cyanuricAcid");
  if (cya) {
    const range = targetRanges.cyanuricAcid;
    if (cya.status === "high") {
      const pct = Math.round(((cya.value - range.target) / cya.value) * 100);
      out.push({
        paramKey: "cyanuricAcid", labelHe: cya.labelHe, measured: cya.value,
        target: range.target, unit: cya.unit, status: "high",
        actionHe: `רמת המייצב (CYA) גבוהה. אין דרך טובה להוריד אותה בכימיקלים — מומלץ להחליף כ־${pct}% מהמים. אין לרוקן את הבריכה לחלוטין ללא ייעוץ איש מקצוע.`,
      });
    } else if (cya.status === "low") {
      out.push({
        paramKey: "cyanuricAcid", labelHe: cya.labelHe, measured: cya.value,
        target: range.target, unit: cya.unit, status: "low",
        actionHe: "רמת המייצב (CYA) נמוכה. הוסף Stabilizer לפי הוראות יצרן. ללא מייצב, הכלור מתפרק מהר בשמש.",
      });
    } else {
      out.push(okRec("cyanuricAcid", cya, range, "רמת המייצב תקינה."));
    }
  }

  const salt = getReading(results, "salt");
  if (salt && pool.type === "salt") {
    const range = targetRanges.salt;
    if (salt.status === "low") {
      const diff = range.target - salt.value;
      const kg = round1(diff * productConfig.poolSalt.dosePerPpmPer10kL * (pool.volumeLiters / 10000));
      out.push({
        paramKey: "salt", labelHe: salt.labelHe, measured: salt.value,
        target: range.target, unit: salt.unit, status: "low",
        actionHe: `רמת המלח נמוכה. הוסף כ־${kg} ק״ג ${productConfig.poolSalt.labelHe}, הפעל סחרור ובדוק שוב לאחר שהמלח מתמוסס.`,
        product: { key: "poolSalt", amount: kg, unit: "ק״ג", labelHe: productConfig.poolSalt.labelHe },
      });
    } else if (salt.status === "high") {
      const pct = Math.round(((salt.value - range.target) / salt.value) * 100);
      out.push({
        paramKey: "salt", labelHe: salt.labelHe, measured: salt.value,
        target: range.target, unit: salt.unit, status: "high",
        actionHe: `רמת המלח גבוהה. מומלץ החלפת מים חלקית של כ־${pct}%. אין לרוקן את הבריכה לחלוטין ללא ייעוץ איש מקצוע.`,
      });
    } else {
      out.push(okRec("salt", salt, range, "רמת המלח תקינה."));
    }
  }

  const hardness = getReading(results, "hardness");
  if (hardness) {
    const range = targetRanges.hardness;
    if (hardness.status === "high") {
      const pct = Math.round(((hardness.value - range.target) / hardness.value) * 100);
      out.push({
        paramKey: "hardness", labelHe: hardness.labelHe, measured: hardness.value,
        target: range.target, unit: hardness.unit, status: "high",
        actionHe: `הקשיות גבוהה. אין דרך להוריד בכימיקלים — מומלץ החלפת מים חלקית של כ־${pct}%.`,
      });
    } else if (hardness.status === "low") {
      out.push({
        paramKey: "hardness", labelHe: hardness.labelHe, measured: hardness.value,
        target: range.target, unit: hardness.unit, status: "low",
        actionHe: "הקשיות נמוכה. מומלץ להוסיף Calcium Hardness Increaser לפי הוראות יצרן.",
      });
    } else {
      out.push(okRec("hardness", hardness, range, "הקשיות תקינה."));
    }
  }

  return out.sort(sortByPriority);
}
