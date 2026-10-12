// Product families from the original UI, not verified treatment protocols.
// Numeric doses require the actual product label and its concentration basis.

export type ProductKey = 'chlorineLiquid10' | 'acidHCl' | 'phPlus' | 'poolSalt';

export interface ProductInfo {
  labelHe: string;
  unit: string;
  type: 'chlorine' | 'acid' | 'ph_plus' | 'salt';
}

export const productConfig: Record<ProductKey, ProductInfo> = {
  chlorineLiquid10: {
    labelHe: 'כלור נוזלי 12%',
    unit: 'מ״ל',
    type: 'chlorine',
  },
  acidHCl: {
    labelHe: 'חומצת מלח 33%',
    unit: 'מ״ל',
    type: 'acid',
  },
  phPlus: {
    labelHe: 'pH Plus',
    unit: 'גרם',
    type: 'ph_plus',
  },
  poolSalt: {
    labelHe: 'מלח לבריכה',
    unit: 'ק״ג',
    type: 'salt',
  },
};
