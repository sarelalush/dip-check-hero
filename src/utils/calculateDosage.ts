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
  /** True only for THE ONE parameter currently being treated. */
  active?: boolean;
  /** True when a higher-priority issue is pending — show as informational. */
  blocked?: boolean;
}

/**
 * Treatment-order priority:
 *   1. Alkalinity
 *   2. pH
 *   3. Free Chlorine
 *   4. CYA / salt / hardness
 *
 * pH safety override: ONLY pH < 7.2 jumps to the top (low pH is dangerous).
 * High pH is treated in the normal order — alkalinity first if needed.
 *
 * Output contract: every reading present gets a card. EXACTLY ONE card is
 * marked `active: true` (the next action). Others are status-only.
 */
const PRIORITY_ORDER = [
  "alkalinity", "ph", "freeChlorine", "cyanuricAcid", "salt", "hardness",
] as const;

const PH_FLOOR = 7.2;

function round1(n: number) { return Math.round(n * 10) / 10; }

function getReading(results: StripResults, key: string): StripReading | undefined {
  // @ts-expect-error dynamic key
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

  const readings = {
    alkalinity: getReading(results, "alkalinity"),
    ph: getReading(results, "ph"),
    freeChlorine: getReading(results, "freeChlorine"),
    cyanuricAcid: getReading(results, "cyanuricAcid"),
    salt: getReading(results, "salt"),
    hardness: getReading(results, "hardness"),
  } as const;

  // Build a card for every reading we have; default to status-only (no action).
  const cards = new Map<string, DosageRecommendation>();
  const statusCard = (key: string, r: StripReading): DosageRecommendation => ({
    paramKey: key,
    labelHe: r.labelHe,
    measured: r.value,
    target: targetRanges[key]?.target ?? r.value,
    unit: r.unit,
    status: r.status,
    actionHe: r.status === "ok" ? "תקין" : r.status === "low" ? "נמוך" : "גבוה",
    blocked: r.status !== "ok",
  });
  for (const [k, r] of Object.entries(readings)) {
    if (r) cards.set(k, statusCard(k, r));
  }

  // Pick THE next action. Sets `active: true` on the chosen card and rewrites
  // its actionHe/product. All other off-spec cards stay informational.
  const setActive = (key: string, patch: Partial<DosageRecommendation>) => {
    const c = cards.get(key);
    if (!c) return;
    cards.set(key, { ...c, ...patch, active: true, blocked: false });
  };

  const alk = readings.alkalinity;
  const ph = readings.ph;
  const fc = readings.freeChlorine;
  const phUnsafe = !!ph && ph.value < PH_FLOOR;

  // Standard footer for every action — uniform UX, no totals shown to user.
  const steps = (firstAction: string) => [
    firstAction,
    `הפעל את משאבת הסחרור והשאר אותה דולקת.`,
    `המתן 4–6 שעות.`,
    `בצע סריקה חדשה של סטיק לבדיקת המצב.`,
  ].join("\n");

  // ── pH safety override — ONLY low pH wins over alkalinity ──
  if (ph && phUnsafe) {
    if (alk?.status === "high") {
      setActive("ph", {
        actionHe: steps(`pH נמוך מדי. פתח את משאבת הסחרור ואת המפלים/ג׳טים לאוורור. אל תוסיף חומצה.`),
      });
    } else {
      const grams = Math.max(100, Math.round((targetRanges.ph.target - ph.value) * volumeM3 * 100));
      setActive("ph", {
        actionHe: steps(`הוסף ${grams} גרם pH Plus ופזר באזורי הסחרור.`),
        product: { key: "phPlus", amount: grams, unit: "גרם", labelHe: productConfig.phPlus.labelHe },
      });
    }
    return [...cards.values()].sort(sortByPriority);
  }

  // ── 1. Alkalinity ──
  if (alk && alk.status !== "ok") {
    if (alk.status === "low") {
      const kg = round1(((targetRanges.alkalinity.target - alk.value) * volumeM3) / 670);
      setActive("alkalinity", {
        actionHe: steps(`פזר ${kg} ק״ג סודה לשתייה (Alkalinity Increaser) באזורי הסחרור.`),
        product: { key: "phPlus", amount: kg * 1000, unit: "גרם", labelHe: "Alkalinity Increaser" },
      });
    } else {
      const liters = round1(((alk.value - targetRanges.alkalinity.target) * volumeM3) / 500);
      const portion = round1(liters / 3);
      setActive("alkalinity", {
        actionHe: steps(`הוסף ${portion} ל׳ חומצת מלח 33% לאזורי הסחרור.`),
        product: { key: "acidHCl", amount: portion * 1000, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
      });
    }
    return [...cards.values()].sort(sortByPriority);
  }

  // ── 2. pH ──
  if (ph && ph.status !== "ok") {
    if (ph.status === "high") {
      const ml = Math.max(50, Math.round(((ph.value - targetRanges.ph.target) * volumeM3) / 20 * 1000));
      setActive("ph", {
        actionHe: steps(`הוסף ${ml} מ״ל חומצת מלח 33% לאזורי הסחרור.`),
        product: { key: "acidHCl", amount: ml, unit: "מ״ל", labelHe: productConfig.acidHCl.labelHe },
      });
    } else {
      const grams = Math.max(50, Math.round((targetRanges.ph.target - ph.value) * volumeM3 * 100));
      setActive("ph", {
        actionHe: steps(`פזר ${grams} גרם pH Plus באזורי הסחרור.`),
        product: { key: "phPlus", amount: grams, unit: "גרם", labelHe: productConfig.phPlus.labelHe },
      });
    }
    return [...cards.values()].sort(sortByPriority);
  }

  // ── 3. Free chlorine ──
  if (fc && fc.status !== "ok") {
    if (fc.status === "low") {
      const ml = Math.max(50, Math.round(((targetRanges.freeChlorine.target - fc.value) * volumeM3) / 100 * 1000));
      setActive("freeChlorine", {
        actionHe: steps(`הוסף ${ml} מ״ל כלור נוזלי 12% לאזורי הסחרור.`),
        product: { key: "chlorineLiquid10", amount: ml, unit: "מ״ל", labelHe: "כלור נוזלי 12%" },
      });
    } else {
      const delta = fc.value - targetRanges.freeChlorine.target;
      if (delta <= 2) {
        setActive("freeChlorine", {
          actionHe: steps(`הפעל את משאבת הסחרור — אין צורך להוסיף חומר.`),
        });
      } else {
        const grams = Math.round(delta * volumeM3);
        setActive("freeChlorine", {
          actionHe: steps(`הוסף ${grams} גרם אנטי־כלור לאזורי הסחרור.`),
        });
      }
    }
    return [...cards.values()].sort(sortByPriority);
  }

  // ── 4. Secondary (only when 1-3 are OK) ──
  const cya = readings.cyanuricAcid;
  if (cya && cya.status !== "ok") {
    if (cya.status === "high") {
      const pct = Math.round(((cya.value - targetRanges.cyanuricAcid.target) / cya.value) * 100);
      setActive("cyanuricAcid", {
        actionHe: steps(`החלף כ־${pct}% מהמים בבריכה (לא לרוקן לחלוטין).`),
      });
    } else {
      setActive("cyanuricAcid", {
        actionHe: steps(`הוסף Stabilizer (CYA) לפי הוראות היצרן.`),
      });
    }
    return [...cards.values()].sort(sortByPriority);
  }

  const salt = readings.salt;
  if (salt && pool.type === "salt" && salt.status !== "ok") {
    if (salt.status === "low") {
      const diff = targetRanges.salt.target - salt.value;
      const kg = round1(diff * productConfig.poolSalt.dosePerPpmPer10kL * (pool.volumeLiters / 10000));
      setActive("salt", {
        actionHe: steps(`פזר ${kg} ק״ג ${productConfig.poolSalt.labelHe} באזורי הסחרור.`),
        product: { key: "poolSalt", amount: kg, unit: "ק״ג", labelHe: productConfig.poolSalt.labelHe },
      });
    } else {
      const pct = Math.round(((salt.value - targetRanges.salt.target) / salt.value) * 100);
      setActive("salt", {
        actionHe: steps(`החלף כ־${pct}% מהמים בבריכה.`),
      });
    }
    return [...cards.values()].sort(sortByPriority);
  }

  const hardness = readings.hardness;
  if (hardness && hardness.status !== "ok") {
    if (hardness.status === "high") {
      const pct = Math.round(((hardness.value - targetRanges.hardness.target) / hardness.value) * 100);
      setActive("hardness", { actionHe: steps(`החלף כ־${pct}% מהמים בבריכה.`) });
    } else {
      setActive("hardness", { actionHe: steps(`הוסף Calcium Hardness Increaser לפי הוראות היצרן.`) });
    }
  }

  // Salt card for chlorine pools should be removed (not relevant).
  if (pool.type !== "salt") cards.delete("salt");

  return [...cards.values()].sort(sortByPriority);
}
