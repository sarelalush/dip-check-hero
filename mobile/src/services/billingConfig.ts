export type BillingProductKind = 'subscription' | 'consumable';

export const BILLING_PRODUCTS = {
  basicMonthly: {
    id: 'basic_monthly',
    kind: 'subscription' as BillingProductKind,
    labelHe: 'מנוי בסיסי',
    fallbackPriceHe: '30 ₪ לחודש',
  },
  extraPoolMonthly: {
    id: 'extra_pool_monthly',
    kind: 'subscription' as BillingProductKind,
    labelHe: 'בריכה נוספת',
    fallbackPriceHe: '10 ₪ לחודש',
  },
  extraScanPack200: {
    id: 'extra_scan_pack_200',
    kind: 'consumable' as BillingProductKind,
    labelHe: 'עוד 200 סריקות',
    fallbackPriceHe: '20 ₪ חד פעמי',
  },
} as const;

export type BillingProductId = (typeof BILLING_PRODUCTS)[keyof typeof BILLING_PRODUCTS]['id'];

export const GOOGLE_PLAY_SUBSCRIPTION_IDS = [
  BILLING_PRODUCTS.basicMonthly.id,
  BILLING_PRODUCTS.extraPoolMonthly.id,
];

export const GOOGLE_PLAY_IN_APP_PRODUCT_IDS = [BILLING_PRODUCTS.extraScanPack200.id];

export function isConsumableBillingProduct(productId: string) {
  return productId === BILLING_PRODUCTS.extraScanPack200.id;
}

export function getBillingProductLabel(productId: string) {
  return Object.values(BILLING_PRODUCTS).find((product) => product.id === productId)?.labelHe ?? productId;
}
