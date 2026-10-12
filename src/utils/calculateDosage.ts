import type { StripResults, StripReading } from "./analyzeStripImage";
import type { ProductKey } from "@/config/productConfig";
import { targetRanges } from "@/config/targetRanges";
import type { Pool } from "./storage";
import type { StripParameter } from "@/config/stripBrands";
export interface DosageRecommendation {
  paramKey: string;
  labelHe: string;
  measured: number;
  target: number;
  unit: string;
  status: "low" | "ok" | "high";
  actionHe: string;
  product?: { key: ProductKey; amount: number; unit: string; labelHe: string };
  active?: boolean;
  blocked?: boolean;
}
// The legacy web client must not expose unvalidated doses either.
export function calculateDosage(results: StripResults, pool: Pool): DosageRecommendation[] {
  void pool;
  const keys: StripParameter[] = ["alkalinity","ph","freeChlorine","cyanuricAcid","salt","hardness"];
  if (results.lowConfidence) return [];
  return keys.flatMap((key) => {
    const legacy = results as unknown as Partial<Record<StripParameter, StripReading>>;
    const reading = results.readings?.[key] ?? legacy[key];
    if (!reading || !Number.isFinite(reading.value)) return [];
    return [{
      paramKey: key, labelHe: reading.labelHe, measured: reading.value,
      target: targetRanges[key]?.target ?? reading.value,
      unit: reading.unit, status: reading.status,
      actionHe: "אמת מדידה לפני טיפול. האפליקציה אינה מחשבת כרגע מינון חומרים.",
      active: false, blocked: true,
    }];
  });
}
