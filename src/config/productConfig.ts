export type ProductKey = "chlorineLiquid10" | "acidHCl" | "phPlus" | "poolSalt";

export interface ProductInfo {
  labelHe: string;
  unit: string;
  type: "chlorine" | "acid" | "ph_plus" | "salt";
  // dose per 1 ppm change per 10,000L (rough MVP estimates — replace with manufacturer specs)
  dosePerPpmPer10kL: number;
}

export const productConfig: Record<ProductKey, ProductInfo> = {
  chlorineLiquid10: {
    labelHe: "כלור נוזלי 10%",
    unit: "מ״ל",
    type: "chlorine",
    dosePerPpmPer10kL: 100,
  },
  acidHCl: {
    labelHe: "חומצת מלח 32%",
    unit: "מ״ל",
    type: "acid",
    // ~100ml of 32% HCl lowers pH by ~0.1 in 10,000L (rough estimate)
    dosePerPpmPer10kL: 100,
  },
  phPlus: {
    labelHe: "pH Plus",
    unit: "גרם",
    type: "ph_plus",
    dosePerPpmPer10kL: 100,
  },
  poolSalt: {
    labelHe: "מלח לבריכה",
    unit: "ק״ג",
    type: "salt",
    dosePerPpmPer10kL: 0.01,
  },
};

