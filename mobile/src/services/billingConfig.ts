export type BillingProductKind = 'subscription' | 'consumable';
export type BillingStorePlatform = 'android' | 'ios';

export const BILLING_PRODUCTS = {
  basicMonthly: {
    id: 'basic-monthly',
    storeIds: {
      android: 'basic-monthly',
      ios: 'basic_monthly',
    },
    kind: 'subscription' as BillingProductKind,
    labelHe: 'מנוי בסיסי',
    fallbackPriceHe: '30 ₪ לחודש',
  },
  extraPoolMonthly: {
    id: 'extra-pool-monthly',
    storeIds: {
      android: 'extra-pool-monthly',
      ios: 'extra_pool_monthly',
    },
    kind: 'subscription' as BillingProductKind,
    labelHe: 'בריכה נוספת',
    fallbackPriceHe: '10 ₪ לחודש',
  },
  extraScanPack200: {
    id: 'extra_scan_pack_200',
    storeIds: {
      android: 'extra_scan_pack_200',
      ios: 'extra_scan_pack_200',
    },
    kind: 'consumable' as BillingProductKind,
    labelHe: 'עוד 200 סריקות',
    fallbackPriceHe: '20 ₪ חד פעמי',
  },
} as const;

export type BillingProductId = (typeof BILLING_PRODUCTS)[keyof typeof BILLING_PRODUCTS]['id'];

export const STORE_SUBSCRIPTION_IDS = [
  BILLING_PRODUCTS.basicMonthly.id,
  BILLING_PRODUCTS.extraPoolMonthly.id,
];

export const STORE_IN_APP_PRODUCT_IDS = [BILLING_PRODUCTS.extraScanPack200.id];

export const GOOGLE_PLAY_SUBSCRIPTION_IDS = STORE_SUBSCRIPTION_IDS;
export const GOOGLE_PLAY_IN_APP_PRODUCT_IDS = STORE_IN_APP_PRODUCT_IDS;

function hasStoreProductId(product: (typeof BILLING_PRODUCTS)[keyof typeof BILLING_PRODUCTS], productId: string) {
  return Object.values(product.storeIds).some((storeId) => storeId === productId);
}

export function getStoreProductId(productId: string, platform: BillingStorePlatform) {
  return (
    Object.values(BILLING_PRODUCTS).find((product) => product.id === productId || hasStoreProductId(product, productId))?.storeIds[platform] ??
    productId
  );
}

export function getStoreProductIdCandidates(productId: string, platform: BillingStorePlatform) {
  const product = Object.values(BILLING_PRODUCTS).find((item) => item.id === productId || hasStoreProductId(item, productId));
  if (!product) return [productId];
  if (platform === 'android') return [product.storeIds.android];

  return Array.from(new Set([product.storeIds.ios, product.id, product.storeIds.android]));
}

export function getStoreSubscriptionIds(platform: BillingStorePlatform) {
  return STORE_SUBSCRIPTION_IDS.flatMap((productId) => getStoreProductIdCandidates(productId, platform));
}

export function getStoreInAppProductIds(platform: BillingStorePlatform) {
  return STORE_IN_APP_PRODUCT_IDS.flatMap((productId) => getStoreProductIdCandidates(productId, platform));
}

export function isConsumableBillingProduct(productId: string) {
  return productId === BILLING_PRODUCTS.extraScanPack200.id || hasStoreProductId(BILLING_PRODUCTS.extraScanPack200, productId);
}

export function getBillingProductLabel(productId: string) {
  return (
    Object.values(BILLING_PRODUCTS).find((product) => product.id === productId || hasStoreProductId(product, productId))?.labelHe ?? productId
  );
}
