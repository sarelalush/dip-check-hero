import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Product, ProductSubscription, Purchase } from 'expo-iap';
import { useIAP } from 'expo-iap';
import { Card } from './Card';
import { LineIcon } from './LineIcon';
import {
  BILLING_PRODUCTS,
  STORE_IN_APP_PRODUCT_IDS,
  STORE_SUBSCRIPTION_IDS,
  getBillingProductLabel,
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
        <Text style={styles.noticeTitle}>רכישות זמינות רק באפליקציה המותקנת</Text>
        <Text style={styles.noticeText}>
          ב-web וב-Expo Go אפשר לראות את המסך, אבל רכישה אמיתית זמינה רק בגרסת Android או iOS שמותקנת דרך החנות.
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

      if (!isSupabaseConfigured || !accountId) {
        setStatus('error');
        setMessage('לא ניתן לאמת רכישה ללא חיבור לחשבון. התחבר ונסה שוב.');
        return;
      }

      try {
        const isApple = storePlatform === 'ios';
        setStatus('verifying');
        setMessage(isApple ? 'מאמתים את הרכישה מול Apple...' : 'מאמתים את הרכישה מול Google Play...');
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

  const { connected, fetchProducts, finishTransaction, products, requestPurchase, subscriptions } = useIAP({
    onPurchaseError(error) {
      setStatus('error');
      setMessage(error.message || 'הרכישה בוטלה או נכשלה.');
    },
    onPurchaseSuccess: handlePurchaseSuccess,
    onError(error) {
      setStatus('error');
      setMessage(error.message || 'לא ניתן להתחבר לחנות כרגע.');
    },
  });

  useEffect(() => {
    if (!connected) return;

    let mounted = true;
    async function loadProducts() {
      try {
        setStatus('loading');
        await Promise.all([
          fetchProducts({ skus: STORE_SUBSCRIPTION_IDS, type: 'subs' }),
          fetchProducts({ skus: STORE_IN_APP_PRODUCT_IDS, type: 'in-app' }),
        ]);
        if (!mounted) return;
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
  }, [connected, fetchProducts]);

  const storeItems = useMemo(() => {
    const map = new Map<string, StoreItem>();
    for (const product of products) {
      map.set(product.id, { displayPrice: product.displayPrice, id: product.id });
    }
    for (const subscription of subscriptions) {
      map.set(subscription.id, {
        displayPrice: subscription.displayPrice,
        id: subscription.id,
        offerToken: getSubscriptionOfferToken(subscription) ?? undefined,
      });
    }
    return map;
  }, [products, subscriptions]);

  const purchase = async (productId: string) => {
    if (!accountId) {
      setStatus('error');
      setMessage('צריך להתחבר לחשבון לפני רכישה.');
      return;
    }

    const item = storeItems.get(productId);
    if (!item && storePlatform === 'android') {
      setStatus('error');
      setMessage('המוצר עדיין לא זמין בחנות. ודא שהוא מוגדר ופעיל בקונסול.');
      return;
    }

    try {
      setActiveProductId(productId);
      setStatus('purchasing');
      setMessage(`פותחים רכישה עבור ${getBillingProductLabel(productId)}...`);
      if (isConsumableBillingProduct(productId)) {
        await requestPurchase({
          request:
            storePlatform === 'ios'
              ? { apple: { sku: productId } }
              : {
                  google: {
                    obfuscatedAccountId: accountId,
                    skus: [productId],
                  },
                },
          type: 'in-app',
        });
      } else {
        await requestPurchase({
          request:
            storePlatform === 'ios'
              ? { apple: { sku: productId } }
              : {
                  google: {
                    obfuscatedAccountId: accountId,
                    skus: [productId],
                    subscriptionOffers: [{ offerToken: requireSubscriptionOfferToken(item), sku: productId }],
                  },
                },
          type: 'subs',
        });
      }
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'לא הצלחנו לפתוח את חלון הרכישה.');
    } finally {
      setActiveProductId(undefined);
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
        label="הפעל מנוי בסיסי"
        onPress={() => purchase(BILLING_PRODUCTS.basicMonthly.id)}
        price={storeItems.get(BILLING_PRODUCTS.basicMonthly.id)?.displayPrice ?? BILLING_PRODUCTS.basicMonthly.fallbackPriceHe}
      />
      <BillingButton
        busy={busy && activeProductId === BILLING_PRODUCTS.extraPoolMonthly.id}
        label="הוסף בריכה נוספת"
        onPress={() => purchase(BILLING_PRODUCTS.extraPoolMonthly.id)}
        price={storeItems.get(BILLING_PRODUCTS.extraPoolMonthly.id)?.displayPrice ?? BILLING_PRODUCTS.extraPoolMonthly.fallbackPriceHe}
      />
      <BillingButton
        busy={busy && activeProductId === BILLING_PRODUCTS.extraScanPack200.id}
        label="רכוש עוד 200 סריקות"
        onPress={() => purchase(BILLING_PRODUCTS.extraScanPack200.id)}
        price={storeItems.get(BILLING_PRODUCTS.extraScanPack200.id)?.displayPrice ?? BILLING_PRODUCTS.extraScanPack200.fallbackPriceHe}
      />
      {busy ? <ActivityIndicator color={colors.primaryDark} size="small" /> : null}
      {message ? <Text style={[styles.statusText, status === 'error' ? styles.errorText : null]}>{message}</Text> : null}
    </Card>
  );
}

function getPurchaseTransactionId(purchase: Purchase) {
  return 'transactionId' in purchase && typeof purchase.transactionId === 'string' ? purchase.transactionId : undefined;
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

function BillingButton({ busy, label, onPress, price }: { busy?: boolean; label: string; onPress: () => void; price: string }) {
  return (
    <Pressable disabled={busy} style={({ pressed }) => [styles.billingButton, pressed ? styles.pressed : null]} onPress={onPress}>
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
});
