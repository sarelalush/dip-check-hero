// Parity source: src/config/stripBrands.ts and SUPPORTED_BRAND_IDS in
// src/routes/select-strip.tsx. Only AquaChek Pro is enabled for scan v1.

import type { StripBrand } from '../domain/strip';

export const DEFAULT_BRAND_ID = 'aquachek-pro-5in1';
export const RECOMMENDED_BRAND_ID = DEFAULT_BRAND_ID;

const SUPPORTED_BRAND_IDS = new Set<string>([DEFAULT_BRAND_ID]);

function withSupport(brand: Omit<StripBrand, 'supportStatus' | 'supported' | 'recommended'>): StripBrand {
  const supported = SUPPORTED_BRAND_IDS.has(brand.id);
  return {
    ...brand,
    supported,
    supportStatus: supported ? 'supported' : 'comingSoon',
    recommended: brand.id === RECOMMENDED_BRAND_ID,
  };
}

export const STRIP_BRANDS: StripBrand[] = [
  withSupport({
    id: 'aquachek-pro-5in1',
    nameHe: 'AquaChek Pro (4 פדים, 5 מדידות)',
    descriptionHe:
      'ברירת מחדל. 4 פדים פיזיים: פד 1 = כלור כולל + ברום כולל, פד 2 = כלור חופשי, פד 3 = pH, פד 4 = אלקליניות.',
    parameters: ['totalChlorine', 'bromine', 'freeChlorine', 'ph', 'alkalinity'],
  }),
  withSupport({
    id: 'aquachek-yellow-4',
    nameHe: 'AquaChek Yellow (4-in-1)',
    descriptionHe: 'כלור חופשי, pH, אלקליניות, חומצה ציאנורית.',
    parameters: ['freeChlorine', 'ph', 'alkalinity', 'cyanuricAcid'],
  }),
  withSupport({
    id: 'aquachek-silver-salt',
    nameHe: 'AquaChek Silver (4-in-1 + מלח)',
    descriptionHe: 'מותאם לבריכות מלח. כלור חופשי, pH, אלקליניות, מלח.',
    parameters: ['freeChlorine', 'ph', 'alkalinity', 'salt'],
  }),
  withSupport({
    id: 'aquachek-7',
    nameHe: 'AquaChek 7-in-1',
    descriptionHe: 'קשיות, כלור כולל, כלור חופשי, ברום, pH, אלקליניות, ציאנורית.',
    parameters: ['hardness', 'totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  }),
  withSupport({
    id: 'hth-6-way',
    nameHe: 'HTH 6-Way',
    descriptionHe: 'כלור כולל, כלור חופשי, ברום, pH, אלקליניות, ציאנורית.',
    parameters: ['totalChlorine', 'freeChlorine', 'bromine', 'ph', 'alkalinity', 'cyanuricAcid'],
  }),
  withSupport({
    id: 'clorox-3in1',
    nameHe: 'Clorox 3-in-1',
    descriptionHe: 'כלור חופשי, pH ואלקליניות.',
    parameters: ['freeChlorine', 'ph', 'alkalinity'],
  }),
];

export const stripBrands = STRIP_BRANDS;

export function getBrand(id?: string): StripBrand {
  return STRIP_BRANDS.find((brand) => brand.id === id) ?? STRIP_BRANDS[0];
}

export function getRecommendedBrand(): StripBrand {
  return getBrand(RECOMMENDED_BRAND_ID);
}
