// Source of truth migrated from web:
// src/config/stripBrands.ts, src/config/brandSwatches.ts, src/config/targetRanges.ts,
// and the supported-brand handling in src/routes/select-strip.tsx.

export type StripParameter =
  | 'freeChlorine'
  | 'totalChlorine'
  | 'bromine'
  | 'ph'
  | 'alkalinity'
  | 'cyanuricAcid'
  | 'hardness'
  | 'salt';

export interface StripParameterMeta {
  labelHe: string;
  unit: string;
}

export const PARAM_LABEL_HE: Record<StripParameter, StripParameterMeta> = {
  freeChlorine: { labelHe: 'כלור חופשי', unit: 'ppm' },
  totalChlorine: { labelHe: 'כלור כולל', unit: 'ppm' },
  bromine: { labelHe: 'ברום', unit: 'ppm' },
  ph: { labelHe: 'pH', unit: '' },
  alkalinity: { labelHe: 'אלקליניות', unit: 'ppm' },
  cyanuricAcid: { labelHe: 'חומצה ציאנורית', unit: 'ppm' },
  hardness: { labelHe: 'קשיות כללית', unit: 'ppm' },
  salt: { labelHe: 'מלח', unit: 'ppm' },
};

export type StripBrandSupportStatus = 'supported' | 'comingSoon';

export interface StripBrand {
  id: string;
  nameHe: string;
  descriptionHe: string;
  parameters: StripParameter[];
  supportStatus: StripBrandSupportStatus;
  supported: boolean;
  recommended?: boolean;
}

export interface TargetRange {
  target: number;
  min: number;
  max: number;
}

export interface Swatch {
  value: number;
  label: string;
  color: string;
}

export interface ParamSwatches {
  paramKey: StripParameter;
  labelHe: string;
  unit: string;
  swatches: Swatch[];
}
