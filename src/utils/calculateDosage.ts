import type { StripResults } from "./analyzeStripImage";
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
  actionHe: string; // human-readable Hebrew recommendation
  product?: { key: ProductKey; amount: number; unit: string; labelHe: string };
}

export function calculateDosage(
  results: StripResults,
  pool: Pool,
): DosageRecommendation[] {
  const recs: DosageRecommendation[] = [];
  const volumeFactor = pool.volumeLiters / 10000;

  // Chlorine
  const fc = results.freeChlorine;
  const fcRange = targetRanges.freeChlorine;
  if (fc.status === "low") {
    const diff = fcRange.target - fc.value;
    const amount = Math.round(diff * productConfig.chlorineLiquid10.dosePerPpmPer10kL * volumeFactor);
    recs.push({
      paramKey: "freeChlorine",
      labelHe: fc.labelHe,
      measured: fc.value,
      target: fcRange.target,
      unit: fc.unit,
      status: "low",
      actionHe: `הוסף ${amount} מ״ל ${productConfig.chlorineLiquid10.labelHe}`,
      product: { key: "chlorineLiquid10", amount, unit: "מ״ל", labelHe: productConfig.chlorineLiquid10.labelHe },
    });
  } else if (fc.status === "high") {
    recs.push({
      paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
      target: fcRange.target, unit: fc.unit, status: "high",
      actionHe: "רמת הכלור גבוהה. המתן מספר שעות ובדוק שוב לפני הוספה",
    });
  } else {
    recs.push({
      paramKey: "freeChlorine", labelHe: fc.labelHe, measured: fc.value,
      target: fcRange.target, unit: fc.unit, status: "ok",
      actionHe: "אין צורך בפעולה",
    });
  }

  // pH
  const ph = results.ph;
  const phRange = targetRanges.ph;
  if (ph.status === "high") {
    const diff = ph.value - phRange.target;
    const amount = Math.round((diff / 0.1) * productConfig.phMinus.dosePerPpmPer10kL * volumeFactor);
    recs.push({
      paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
      target: phRange.target, unit: ph.unit, status: "high",
      actionHe: `הוסף ${amount} גרם ${productConfig.phMinus.labelHe}`,
      product: { key: "phMinus", amount, unit: "גרם", labelHe: productConfig.phMinus.labelHe },
    });
  } else if (ph.status === "low") {
    const diff = phRange.target - ph.value;
    const amount = Math.round((diff / 0.1) * productConfig.phPlus.dosePerPpmPer10kL * volumeFactor);
    recs.push({
      paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
      target: phRange.target, unit: ph.unit, status: "low",
      actionHe: `הוסף ${amount} גרם ${productConfig.phPlus.labelHe}`,
      product: { key: "phPlus", amount, unit: "גרם", labelHe: productConfig.phPlus.labelHe },
    });
  } else {
    recs.push({
      paramKey: "ph", labelHe: ph.labelHe, measured: ph.value,
      target: phRange.target, unit: ph.unit, status: "ok",
      actionHe: "אין צורך בפעולה",
    });
  }

  // Alkalinity
  const alk = results.alkalinity;
  const alkRange = targetRanges.alkalinity;
  recs.push({
    paramKey: "alkalinity", labelHe: alk.labelHe, measured: alk.value,
    target: alkRange.target, unit: alk.unit, status: alk.status,
    actionHe: alk.status === "ok"
      ? "אין צורך בפעולה"
      : alk.status === "low"
        ? "אלקליניות נמוכה - מומלץ להוסיף מגביר אלקליניות לפי הוראות יצרן"
        : "אלקליניות גבוהה - מומלץ להמתין ולבדוק שוב",
  });

  // Salt (only saltwater pools)
  if (results.salt && pool.type === "salt") {
    const s = results.salt;
    const sRange = targetRanges.salt;
    if (s.status === "low") {
      const diff = sRange.target - s.value;
      const amount = +(diff * productConfig.poolSalt.dosePerPpmPer10kL * volumeFactor).toFixed(1);
      recs.push({
        paramKey: "salt", labelHe: s.labelHe, measured: s.value,
        target: sRange.target, unit: s.unit, status: "low",
        actionHe: `הוסף ${amount} ק״ג ${productConfig.poolSalt.labelHe}`,
        product: { key: "poolSalt", amount, unit: "ק״ג", labelHe: productConfig.poolSalt.labelHe },
      });
    } else {
      recs.push({
        paramKey: "salt", labelHe: s.labelHe, measured: s.value,
        target: sRange.target, unit: s.unit, status: s.status,
        actionHe: s.status === "ok" ? "אין צורך בפעולה" : "רמת המלח גבוהה - מומלץ לדלל את המים",
      });
    }
  }

  return recs;
}
