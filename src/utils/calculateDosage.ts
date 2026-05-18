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
 * Treatment-order priority — must follow this sequence in pool chemistry:
 *   1. Alkalinity   (buffers pH; treat first)
 *   2. pH           (only after TA is in range, with some exceptions)
 *   3. Free Chlorine (effectiveness depends on pH)
 *   4. CYA / salt / hardness / others
 */
const PRIORITY_ORDER = [
  "alkalinity",
  "ph",
  "freeChlorine",
  "cyanuricAcid",
  "salt",
  "hardness",
] as const;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function getReading(results: StripResults, key: string): StripReading | undefined {
  // back-compat shortcuts + readings map
  // @ts-expect-error dynamic key
  return results[key] ?? results.readings?.[key];
}

export function calculateDosage(
  results: StripResults,
  pool: Pool,
): DosageRecommendation[] {
  const volumeM3 = pool.volumeLiters / 1000;
  const out: DosageRecommendation[] = [];

  // Snapshot statuses up-front so downstream params know what's off.
  const alk = getReading(results, "alkalinity");
  const ph = getReading(results, "ph");
  const fc = getReading(results, "freeChlorine");

  const alkOk = !alk || alk.status === "ok";
  const phOk = !ph || ph.status === "ok";

  // ──────────────────── 1. ALKALINITY ────────────────────
  if (alk) {
    const range = targetRanges.alkalinity;
    if (alk.status === "low") {
      const delta = range.target - alk.value;
      const kg = round1((delta * volumeM3) / 670);
      out.push({
        paramKey: "alkalinity",
        labelHe: alk.labelHe,
        measured: alk.value,
        target: range.target,
        unit: alk.unit,
        status: "low",
        actionHe: `האלקליניות נמוכה. הוסף כ־${kg} ק״ג סודה לשתייה (Alkalinity Increaser) בהדרגה, הפעל סחרור ובדוק שוב.`,
        product: { key: "phPlus", amount: kg * 1000, unit: "גרם", labelHe: "Alkalinity Increaser (סודה לשתייה)" },
      });
    } else if (alk.status === "high") {
      const delta = alk.value - range.target;
      const liters = round1((delta * volumeM3) / 500);
      // Suggest treating in 2-3 portions
      const portion = round1(liters / 3);
      out.push({
        paramKey: "alkalinity",
        labelHe: alk.labelHe,
        measured: alk.value,
        target: range.target,
        unit: alk.unit,
        status: "high",
        actionHe: `האלקליניות גבוהה. סה״כ כ־${liters} ליטר חומצת מלח 33% — מומלץ להוסיף בהדרגה (כ־${portion} ליטר בכל פעם), להפעיל סחרור, ולבדוק שוב pH ואלקליניות לפני המשך.`,
        product: { key: "acidHCl", amount: liters * 1000, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
      });
    } else {
      out.push({
        paramKey: "alkalinity", labelHe: alk.labelHe, measured: alk.value,
        target: range.target, unit: alk.unit, status: "ok",
        actionHe: "אלקליניות תקינה. אין צורך בפעולה.",
      });
    }
  }

  // ──────────────────── 2. pH ────────────────────
  if (ph) {
    const range = targetRanges.ph;
    if (!alkOk && alk!.status === "low" && ph.status !== "ok") {
      // Wait for TA — adjusting pH first will swing it back.
      out.push({
        paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
        target: range.target, unit: ph.unit, status: ph.status,
        blocked: true,
        actionHe: "ה־pH לא מאוזן, אך יש לטפל קודם באלקליניות. בדוק שוב את ה־pH לאחר ייצוב האלקליניות.",
      });
    } else if (ph.status === "low" && alk?.status === "high") {
      // Don't add acid — would drop alkalinity. Aerate instead.
      out.push({
        paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
        target: range.target, unit: ph.unit, status: "low",
        actionHe: "ה־pH נמוך אבל האלקליניות גבוהה — לא להוסיף חומצה. מומלץ להגביר אוורור (סחרור, מפלים, ג׳טים) כדי להעלות pH מבלי להעלות אלקליניות.",
      });
    } else if (ph.status === "high") {
      const delta = ph.value - range.target;
      // ~1 L of 33% HCl drops pH ~0.4 in 50 m³  →  L ≈ Δph × Vm³ / 20
      const liters = round1((delta * volumeM3) / 20);
      const ml = Math.max(50, Math.round(liters * 1000));
      out.push({
        paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
        target: range.target, unit: ph.unit, status: "high",
        actionHe: `ה־pH גבוה. הוסף כ־${ml} מ״ל חומצת מלח 33% בהדרגה, הפעל סחרור ובדוק שוב לפני המשך.`,
        product: { key: "acidHCl", amount: ml, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
      });
    } else if (ph.status === "low") {
      const delta = range.target - ph.value;
      // ~100 g sodium carbonate / 10 m³ raises pH ~0.1  →  g ≈ Δph × Vm³ × 100
      const grams = Math.max(50, Math.round(delta * volumeM3 * 100));
      out.push({
        paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
        target: range.target, unit: ph.unit, status: "low",
        actionHe: `ה־pH נמוך. הוסף כ־${grams} גרם pH Plus (סודה אש) בהדרגה, הפעל סחרור ובדוק שוב.`,
        product: { key: "phPlus", amount: grams, unit: "גרם", labelHe: productConfig.phPlus.labelHe },
      });
    } else {
      out.push({
        paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
        target: range.target, unit: ph.unit, status: "ok",
        actionHe: "ה־pH תקין. אין צורך בפעולה.",
      });
    }
  }

  // ──────────────────── 3. FREE CHLORINE ────────────────────
  if (fc) {
    const range = targetRanges.freeChlorine;
    if (!phOk || !alkOk) {
      // pH/TA pollutes chlorine effectiveness — handle them first.
      out.push({
        paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
        target: range.target, unit: fc.unit, status: fc.status,
        blocked: true,
        actionHe: !alkOk
          ? "כדי שהכלור יפעל ביעילות, יש לאזן קודם אלקליניות ו־pH. בדוק שוב כלור לאחר מכן."
          : "ה־pH לא תקין — כשהוא חורג, יעילות הכלור יורדת. אזן קודם pH ובדוק שוב כלור.",
      });
    } else if (fc.status === "low") {
      const delta = range.target - fc.value;
      // 1 L of 12% liquid chlorine raises ~1 ppm in 100 m³ → L ≈ ΔCl × Vm³ / 100
      const liters = (delta * volumeM3) / 100;
      const ml = Math.max(50, Math.round(liters * 1000));
      out.push({
        paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
        target: range.target, unit: fc.unit, status: "low",
        actionHe: `רמת הכלור נמוכה. הוסף כ־${ml} מ״ל כלור נוזלי 12%, הפעל סחרור ובדוק שוב.`,
        product: { key: "chlorineLiquid10", amount: ml, unit: "מ״ל", labelHe: "כלור נוזלי 12%" },
      });
    } else if (fc.status === "high") {
      const delta = fc.value - range.target;
      if (delta <= 2) {
        // Only slightly high — wait it out.
        out.push({
          paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
          target: range.target, unit: fc.unit, status: "high",
          actionHe: "רמת הכלור מעט גבוהה. מומלץ להמתין מספר שעות, להפעיל סחרור, ולבדוק שוב לפני כל פעולה.",
        });
      } else {
        // Significantly high — anti-chlorine grams ≈ ΔCl × Vm³
        const grams = Math.round(delta * volumeM3);
        out.push({
          paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
          target: range.target, unit: fc.unit, status: "high",
          actionHe: `רמת הכלור גבוהה משמעותית. ניתן להוסיף כ־${grams} גרם אנטי־כלור (Sodium Thiosulfate), או להמתין ולסחרר ולבדוק שוב.`,
        });
      }
    } else {
      out.push({
        paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
        target: range.target, unit: fc.unit, status: "ok",
        actionHe: "רמת הכלור תקינה. אין צורך בפעולה.",
      });
    }
  }

  // ──────────────────── 4. SECONDARY (water-replacement) ────────────────────
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
      out.push({
        paramKey: "cyanuricAcid", labelHe: cya.labelHe, measured: cya.value,
        target: range.target, unit: cya.unit, status: "ok",
        actionHe: "רמת המייצב תקינה.",
      });
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
      out.push({
        paramKey: "salt", labelHe: salt.labelHe, measured: salt.value,
        target: range.target, unit: salt.unit, status: "ok",
        actionHe: "רמת המלח תקינה.",
      });
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
    } else {
      out.push({
        paramKey: "hardness", labelHe: hardness.labelHe, measured: hardness.value,
        target: range.target, unit: hardness.unit, status: hardness.status,
        actionHe: hardness.status === "ok"
          ? "הקשיות תקינה."
          : "הקשיות נמוכה. מומלץ להוסיף Calcium Hardness Increaser לפי הוראות יצרן.",
      });
    }
  }

  // Sort by treatment priority so the UI surfaces the first action to take.
  out.sort((a, b) => {
    const ai = PRIORITY_ORDER.indexOf(a.paramKey as typeof PRIORITY_ORDER[number]);
    const bi = PRIORITY_ORDER.indexOf(b.paramKey as typeof PRIORITY_ORDER[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return out;
}
