export type ProductKey = "chlorineLiquid10" | "phMinus" | "phPlus" | "poolSalt";

export interface ProductInfo {
  labelHe: string;
  unit: string;
  type: "chlorine" | "ph_minus" | "ph_plus" | "salt";
  // dose per 1 ppm change per 10,000L (rough MVP estimates — replace with manufacturer specs)
  dosePerPpmPer10kL: number;
}

export const productConfig: Record<ProductKey, ProductInfo> = {
  chlorineLiquid10: {
    labelHe: "כלור נוזלי 10%",
    unit: "מ״ל",
    type: "chlorine",
    dosePerPpmPer10kL: 100, // ~100ml per 1ppm per 10,000L
  },
  phMinus: {
    labelHe: "pH Minus",
    unit: "גרם",
    type: "ph_minus",
    dosePerPpmPer10kL: 150, // grams per 0.1 pH per 10,000L
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
    dosePerPpmPer10kL: 0.01, // kg per 1ppm per 10,000L
  },
};
