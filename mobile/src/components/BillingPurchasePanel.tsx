import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProductOrSubscription, ProductSubscription, Purchase } from 'expo-iap';
import { fetchProducts, useIAP } from 'expo-iap';
import { Card } from './Card';
import { LineIcon } from './LineIcon';
import {
  BILLING_PRODUCTS,
  getBillingProductLabel,
  getStoreInAppProductIds,
  getStoreProductId,
  getStoreProductIdCandidates,
  getStoreSubscriptionIds,
  isConsumableBillingProduct,
} from '../services/billingConfig';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import { colors, radius, rtl, typography } from '../theme';

type PurchaseStatus = 'idle' | 'loading' | 'purchasing' | 'verifying' | 'success' | 'error';
type StorePlatform = 'android' | 'ios';

interface BillingPurchasePanelProps {
  accountId?: string;
  onPurchaseVerified?: () => Promise<void> | void;
}

interface StoreItem {
  displayPrice?: string;
  id: string;
  offerToken?: string;
}

export function BillingPurchasePanel(props: BillingPurchasePanelProps) {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
    return (
      <Card compact style={styles.noticeCard}>
        <Text style={styles.noticeTitle}>רכישות זמינות באפליקציה המותקנת</Text>
        <Text style={styles.noticeText}>
          בגרסת הדפדפן אפשר לצפות במסך בלבד. רכישה אמיתית זמינה רק באפליקציה שמותקנת דרך החנות של המכשיר.
        </Text>
      </Card>
    );
  }

  return <NativeBillingPurchasePanel {...props} storePlatform={Platform.OS} />;
}

function NativeBillingPurchasePanel({
  accountId,
  onPurchaseVerified,
  storePlatform,
}: BillingPurchasePanelProps & { storePlatform: StorePlatform }) {
  const processedPurchaseTokens = useRef(new Set<string>());
  const [status, setStatus] = useState<PurchaseStatus>('idle');
  const [message, setMessage] = useState<string>();
  const [activeProductId, setActiveProductId] = useState<string>();
  const [storeItems, setStoreItems] = useState(() => new Map<string, StoreItem>());

  const handlePurchaseSuccess = useCallback(
    async (purchase: Purchase) => {
      const productId = purchase.productId;
      const purchaseToken = purchase.purchaseToken ?? getPurchaseTransactionId(purchase);
      if (!productId || !purchaseToken) {
        setStatus('error');
        setMessage('הרכישה התקבלה ללא מזהה תקין. נסה שוב בעוד רגע.');
        return;
      }

      if (processedPurchaseTokens.current.has(purchaseToken)) return;
      processedPurchaseTokens.current.add(purchaseToken);

      const isApple = storePlatform === 'ios';

      if (!isSupabaseConfigured || !accountId) {
        setStatus('error');
        setMessage('מכינים את הרכישה המאובטחת. נסה שוב בעוד רגע.');
        return;
      }

      try {
        setStatus('verifying');
        setMessage(isApple ? 'מאמתים את הרכישה מול Apple...' : 'מאמתים את הרכישה מול החנות...');
        const { data, error } = await getSupabaseClient().functions.invoke(
          isApple ? 'verify-apple-purchase' : 'verify-google-play-purchase',
          {
            body: {
              accountId,
              productId,
              purchase,
              purchaseToken,
              signedTransactionInfo: purchase.purchaseToken,
              transactionId: getPurchaseTransactionId(purchase),
              platform: storePlatform,
            },
          },
        );

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.message ?? 'הרכישה לא אומתה.');

        await finishTransaction({
          purchase,
          isConsumable: isConsumableBillingProduct(productId),
        });
        await onPurchaseVerified?.();
        setStatus('success');
        setMessage('הרכישה אומתה והמכסה עודכנה.');
      } catch (error) {
        processedPurchaseTokens.current.delete(purchaseToken);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'לא הצלחנו לאמת את הרכישה. נסה שוב.');
      }
    },
    [accountId, onPurchaseVerified, storePlatform],
  );

  const { connected, finishTransaction, requestPurchase, restorePurchases } = useIAP({
    onPurchaseError(error) {
      setStatus('error');
      setMessage(getPurchaseErrorMessage(error.message, storePlatform));
    },
    onPurchaseSuccess: handlePurchaseSuccess,
    onError(error) {
      setStatus('error');
      setMessage(error.message || 'לא ניתן להתחבר לחנות כרגע.');
    },
  });

  const storeSubscriptionIds = useMemo(() => getStoreSubscriptionIds(storePlatform), [storePlatform]);
  const storeInAppProductIds = useMemo(() => getStoreInAppProductIds(storePlatform), [storePlatform]);

  const queryStoreItems = useCallback(async () => {
    const loadedItems = (
      await Promise.all([
        fetchProducts({ skus: storeSubscriptionIds, type: 'subs' }),
        fetchProducts({ skus: storeInAppProductIds, type: 'in-app' }),
      ])
    ).flatMap((items) => items ?? []);

    const nextItems = createStoreItems(loadedItems ?? []);
    console.info('[billing] StoreKit products loaded', {
      requested: [...storeSubscriptionIds, ...storeInAppProductIds],
      returned: [...nextItems.keys()],
      storePlatform,
    });
    return nextItems;
  }, [storeInAppProductIds, storePlatform, storeSubscriptionIds]);

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    async function loadProducts() {
      try {
        setStatus('loading');
        const nextItems = await queryStoreItems();
        if (!mounted) return;
        setStoreItems(nextItems);
        setStatus('idle');
        setMessage(undefined);
      } catch (error) {
        if (!mounted) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'לא הצלחנו לטעון מוצרים מהחנות.');
      }
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, [connected, queryStoreItems]);

  const purchase = async (productId: string) => {
    if (!accountId) {
      setStatus('error');
      setMessage('מכינים את הרכישה המאובטחת. נסה שוב בעוד רגע.');
      return;
    }

    let availableStoreItems = storeItems;
    let storeProductId = resolveLoadedStoreProductId(productId, storePlatform, availableStoreItems);
    let item = availableStoreItems.get(storeProductId);
    if (!item) {
      try {
        setStatus('loading');
        setMessage('\u05de\u05e8\u05e2\u05e0\u05e0\u05d9\u05dd \u05d0\u05ea \u05de\u05d5\u05e6\u05e8\u05d9 \u05d4\u05d7\u05e0\u05d5\u05ea...');
        availableStoreItems = await queryStoreItems();
        setStoreItems(availableStoreItems);
        storeProductId = resolveLoadedStoreProductId(productId, storePlatform, availableStoreItems);
        item = availableStoreItems.get(storeProductId);
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? getPurchaseErrorMessage(error.message, storePlatform) : getUnavailableProductMessage(storePlatform));
        return;
      }

      if (!item) {
        setStatus('error');
        setMessage(getUnavailableProductMessage(storePlatform));
        return;
      }
    }

    try {
      setActiveProductId(productId);
      setStatus('purchasing');
      setMessage(`פותחים רכישה עבור ${getBillingProductLabel(productId)}...`);
      if (isConsumableBillingProduct(productId)) {
        await requestPurchase({
          request:
            storePlatform === 'ios'
              ? { apple: { sku: storeProductId } }
              : {
                  google: {
                    obfuscatedAccountId: accountId ?? '',
                    skus: [storeProductId],
                  },
                },
          type: 'in-app',
        });
      } else {
        await requestPurchase({
          request:
            storePlatform === 'ios'
              ? { apple: { sku: storeProductId } }
              : {
                  google: {
                    obfuscatedAccountId: accountId ?? '',
                    skus: [storeProductId],
                    subscriptionOffers: [{ offerToken: requireSubscriptionOfferToken(item), sku: storeProductId }],
                  },
                },
          type: 'subs',
        });
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? getPurchaseErrorMessage(error.message, storePlatform) : 'לא הצלחנו לפתוח את חלון הרכישה.');
    } finally {
      setActiveProductId(undefined);
    }
  };

  const restore = async () => {
    if (!accountId) {
      setStatus('error');
      setMessage('מכינים את שחזור הרכישות. נסה שוב בעוד רגע.');
      return;
    }

    try {
      setActiveProductId(undefined);
      setStatus('verifying');
      setMessage('מחפשים רכישות פעילות בחנות...');
      await restorePurchases({ alsoPublishToEventListenerIOS: true, onlyIncludeActiveItemsIOS: true });
      setStatus('success');
      setMessage('אם נמצאה רכישה פעילה, היא תאומת ותופעל במכשיר הזה.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'לא הצלחנו לשחזר רכישות כרגע.');
    }
  };

  const busy = status === 'loading' || status === 'purchasing' || status === 'verifying';

  return (
    <Card compact style={styles.panel}>
      <View style={styles.panelHeader}>
        <LineIcon name="drop" color={colors.primaryDark} size={18} />
        <Text style={styles.panelTitle}>שדרוגים ורכישות</Text>
      </View>
      <BillingButton
        busy={busy && activeProductId === BILLING_PRODUCTS.basicMonthly.id}
        disabled={busy}
        label="הפעל מנוי בסיסי"
        onPress={() => purchase(BILLING_PRODUCTS.basicMonthly.id)}
        price={getStoreItemPrice(BILLING_PRODUCTS.basicMonthly.id, storePlatform, storeItems) ?? BILLING_PRODUCTS.basicMonthly.fallbackPriceHe}
      />
      <BillingButton
        busy={busy && activeProductId === BILLING_PRODUCTS.extraPoolMonthly.id}
        disabled={busy}
        label="הוסף בריכה נוספת"
        onPress={() => purchase(BILLING_PRODUCTS.extraPoolMonthly.id)}
        price={
          getStoreItemPrice(BILLING_PRODUCTS.extraPoolMonthly.id, storePlatform, storeItems) ?? BILLING_PRODUCTS.extraPoolMonthly.fallbackPriceHe
        }
      />
      <BillingButton
        busy={busy && activeProductId === BILLING_PRODUCTS.extraScanPack200.id}
        disabled={busy}
        label="רכוש עוד 200 סריקות"
        onPress={() => purchase(BILLING_PRODUCTS.extraScanPack200.id)}
        price={
          getStoreItemPrice(BILLING_PRODUCTS.extraScanPack200.id, storePlatform, storeItems) ?? BILLING_PRODUCTS.extraScanPack200.fallbackPriceHe
        }
      />
      <Pressable disabled={busy} onPress={restore} style={({ pressed }) => [styles.restoreButton, busy && styles.disabled, pressed && !busy ? styles.pressed : null]}>
        <LineIcon name="history" color={colors.primaryDark} size={16} />
        <Text style={styles.restoreText}>שחזור רכישות</Text>
      </Pressable>
      {busy ? <ActivityIndicator color={colors.primaryDark} size="small" /> : null}
      {message ? <Text style={[styles.statusText, status === 'error' ? styles.errorText : null]}>{message}</Text> : null}
    </Card>
  );
}

function getPurchaseTransactionId(purchase: Purchase) {
  return 'transactionId' in purchase && typeof purchase.transactionId === 'string' ? purchase.transactionId : undefined;
}

function resolveLoadedStoreProductId(productId: string, storePlatform: StorePlatform, storeItems: Map<string, StoreItem>) {
  return (
    getStoreProductIdCandidates(productId, storePlatform).find((candidate) => storeItems.has(candidate)) ??
    getStoreProductId(productId, storePlatform)
  );
}

function getStoreItemPrice(productId: string, storePlatform: StorePlatform, storeItems: Map<string, StoreItem>) {
  return storeItems.get(resolveLoadedStoreProductId(productId, storePlatform, storeItems))?.displayPrice;
}

function getUnavailableProductMessage(storePlatform: StorePlatform) {
  return storePlatform === 'ios'
    ? 'המוצר עדיין לא זמין לרכישה בחנות. ודא שהמוצר מצורף לגרסת האפליקציה שנשלחה לבדיקה, שיש לו מחיר ולוקליזציה, ושמותקנת הגרסה האחרונה לבדיקה.'
    : 'המוצר עדיין לא זמין לרכישה בחנות. ודא שהוא מוגדר, פעיל ומשויך לגרסה האחרונה שנשלחה לבדיקה.';
}

function getPurchaseErrorMessage(message: string | undefined, storePlatform: StorePlatform) {
  if (/sku|product.*not.*found|item.*not.*available/i.test(message ?? '')) {
    return getUnavailableProductMessage(storePlatform);
  }
  return message || 'הרכישה בוטלה או נכשלה.';
}

function requireSubscriptionOfferToken(item?: StoreItem) {
  if (!item?.offerToken) {
    throw new Error('לא נמצאה הצעת מנוי פעילה עבור המוצר הזה.');
  }
  return item.offerToken;
}

function getSubscriptionOfferToken(subscription: ProductSubscription) {
  const androidOfferDetails = (subscription as ProductSubscription & {
    subscriptionOfferDetailsAndroid?: Array<{ offerToken?: string | null }>;
  }).subscriptionOfferDetailsAndroid;

  return (
    subscription.subscriptionOffers?.find((offer) => Boolean(offer.offerTokenAndroid))?.offerTokenAndroid ??
    androidOfferDetails?.find((offer) => Boolean(offer.offerToken))?.offerToken
  );
}

function createStoreItems(items: ProductOrSubscription[]) {
  const map = new Map<string, StoreItem>();
  for (const item of items) {
    map.set(item.id, {
      displayPrice: item.displayPrice,
      id: item.id,
      offerToken: getSubscriptionOfferToken(item as ProductSubscription) ?? undefined,
    });
  }
  return map;
}

function BillingButton({
  busy,
  disabled,
  label,
  onPress,
  price,
}: {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  price: string;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }) => [styles.billingButton, disabled ? styles.disabled : null, pressed && !disabled ? styles.pressed : null]}
      onPress={onPress}
    >
      <View style={styles.billingIcon}>
        {busy ? <ActivityIndicator color={colors.white} size="small" /> : <LineIcon name="plus" color={colors.white} size={18} />}
      </View>
      <View style={styles.billingCopy}>
        <Text style={styles.billingLabel}>{label}</Text>
        <Text style={styles.billingPrice}>{price}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  noticeCard: {
    marginTop: 14,
    gap: 5,
  },
  noticeTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  noticeText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    ...rtl.text,
  },
  panel: {
    marginTop: 14,
    gap: 10,
  },
  panelHeader: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  panelTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  billingButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSoft,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  pressed: {
    opacity: 0.82,
  },
  billingIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  billingCopy: {
    flex: 1,
  },
  billingLabel: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  billingPrice: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 2,
    ...rtl.text,
  },
  statusText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.textCenter,
  },
  errorText: {
    color: colors.danger,
  },
  restoreButton: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  restoreText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.54,
  },
});
