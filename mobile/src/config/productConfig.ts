// Parity source: src/config/productConfig.ts.

export type ProductKey = 'chlorineLiquid10' | 'acidHCl' | 'phPlus' | 'poolSalt';

export interface ProductInfo {
  labelHe: string;
  unit: string;
  type: 'chlorine' | 'acid' | 'ph_plus' | 'salt';
  dosePerPpmPer10kL: number;
}

export const productConfig: Record<ProductKey, ProductInfo> = {
  chlorineLiquid10: {
    labelHe: 'כלור נוזלי 10%',
    unit: 'מ״ל',
    type: 'chlorine',
    dosePerPpmPer10kL: 100,
  },
  acidHCl: {
    labelHe: 'חומצת מלח 32%',
    unit: 'מ״ל',
    type: 'acid',
    dosePerPpmPer10kL: 100,
  },
  phPlus: {
    labelHe: 'pH Plus',
    unit: 'גרם',
    type: 'ph_plus',
    dosePerPpmPer10kL: 100,
  },
  poolSalt: {
    labelHe: 'מלח לבריכה',
    unit: 'ק״ג',
    type: 'salt',
    dosePerPpmPer10kL: 0.01,
  },
};
