// Brand-independent materials. Keep chlorineLiquid10 as a persisted legacy key;
// the supported liquid concentration is 12 trade % (120 g/L available chlorine).

export type ProductKey = 'chlorineLiquid10' | 'acidHCl' | 'phPlus' | 'poolSalt' | 'sodiumBicarbonate';

export interface ProductInfo {
  labelHe: string;
  unit: string;
  type: 'chlorine' | 'acid' | 'ph_plus' | 'salt' | 'alkalinity';
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
    labelHe: 'מעלה pH — נתרן פחמתי 99%–100%',
    unit: 'גרם',
    type: 'ph_plus',
  },
  poolSalt: {
    labelHe: 'מלח לבריכה',
    unit: 'ק״ג',
    type: 'salt',
  },
  sodiumBicarbonate: {
    labelHe: 'נתרן ביקרבונט לבריכות (99%–100%)',
    unit: 'גרם',
    type: 'alkalinity',
  },
};

export const FIXED_DOSING_MATERIALS = {
  chlorine: { availableChlorineGramsPerLiter: 120, labelHe: 'כלור נוזלי 12%',
    requirementHe: 'החישוב מתאים ל־120 גרם כלור פעיל בליטר. הכיתוב 12% לבדו אינו תמיד מציין את אותו ריכוז.' },
  acid: { massFractionHCl: 0.33, labelHe: 'חומצת מלח 33%',
    requirementHe: 'חומצת מלח (HCl) בריכוז 33% משקלי בלבד. אין להחליף בחומצה יבשה או בריכוז אחר.' },
  phPlus: { labelHe: 'מעלה pH — נתרן פחמתי 99%–100%',
    requirementHe: 'נתרן פחמתי (Na₂CO₃ / סודה אש) לבריכות, 99%–100%. החישוב אינו מתאים לסודה קאוסטית, לנתרן ביקרבונט או לתערובת אחרת.' },
} as const;
