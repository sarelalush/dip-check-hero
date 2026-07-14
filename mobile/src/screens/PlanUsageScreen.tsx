import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PLAN_ADDONS, fetchPlanUsage, getFallbackPlanUsage, type PlanUsageInfo } from '../services/usageService';
import { useAuth } from '../state/AuthContext';
import { usePools } from '../state/PoolsContext';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanUsage'>;
type PurchaseReason = NonNullable<RootStackParamList['Purchase']>['reason'];

function pct(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function formatUsageValue(used: number, limit: number, unit: string) {
  const count = `${used.toLocaleString('en-US')} / ${limit.toLocaleString('en-US')}`;
  return `‎${count}‎ ${unit}`;
}

export function PlanUsageScreen({ navigation, route }: Props) {
  const { accountId } = useAuth();
  const { pools } = usePools();
  const [usage, setUsage] = useState<PlanUsageInfo>(() => getFallbackPlanUsage(pools.length));
  const [loading, setLoading] = useState(true);
  const reason = route.params?.reason;
  const purchaseReason: PurchaseReason = reason ?? 'subscriptionRequired';

  const loadUsage = useCallback(async () => {
    setLoading(true);
    const nextUsage = await fetchPlanUsage(accountId, pools.length);
    setUsage(nextUsage);
    setLoading(false);
  }, [accountId, pools.length]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const scanPercent = pct(usage.scansUsed, usage.scansLimit);
  const poolPercent = pct(usage.activePoolsUsed, usage.activePoolLimit);
  const reasonTitle =
    reason === 'subscriptionRequired'
      ? 'נדרש מנוי פעיל'
      : reason === 'scanQuota'
        ? 'הגעת למכסת הסריקות החודשית'
        : 'הגעת למכסת הבריכות הפעילות';
  const reasonText =
    reason === 'subscriptionRequired'
      ? 'כדי ליצור בריכה, לסרוק סטיק ולקבל המלצות צריך להפעיל מנוי חודשי.'
      : reason === 'scanQuota'
        ? 'המנוי כולל 200 סריקות בחודש. ניתן לרכוש חבילת סריקות נוספת.'
        : 'המנוי הנוכחי כולל בריכה פעילה אחת. ניתן להוסיף בריכות נוספות דרך שדרוג.';

  return (
    <AppShell activeTab="settings" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>מנוי ושימוש</Text>
        <Text style={styles.subtitle}>מעקב פשוט אחר הבריכות והסריקות בחודש הנוכחי</Text>
      </View>

      {reason ? (
        <Card compact style={styles.alertCard}>
          <View style={styles.alertIcon}>
            <LineIcon name="help" color={colors.warning} size={17} />
          </View>
          <View style={styles.alertCopy}>
            <Text style={styles.alertTitle}>{reasonTitle}</Text>
            <Text style={styles.alertText}>{reasonText}</Text>
          </View>
        </Card>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.purchaseButton, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Purchase', { reason: purchaseReason })}
      >
        <View style={styles.purchaseIcon}>
          <LineIcon name="drop" color={colors.primaryDark} size={20} />
        </View>
        <View style={styles.purchaseCopy}>
          <Text style={styles.purchaseTitle}>רכישת מנוי ושדרוגים</Text>
          <Text style={styles.purchaseSubtitle}>פתח את מסך הרכישה ובחר מנוי או תוספת</Text>
        </View>
        <LineIcon name="chevronLeft" color={colors.white} size={18} />
      </Pressable>

      <Card style={styles.planCard}>
        <View style={styles.planTop}>
          <View style={styles.planIcon}>
            <LineIcon name="drop" color={colors.white} size={24} />
          </View>
          <View style={styles.planCopy}>
            <Text style={styles.planLabel}>התוכנית הנוכחית</Text>
            <Text style={styles.planName}>{usage.planName}</Text>
            <Text style={styles.planPrice}>30 ₪ לחודש</Text>
          </View>
        </View>
        {loading ? <ActivityIndicator color={colors.primaryDark} size="small" /> : null}
      </Card>

      <View style={styles.metrics}>
        <UsageMeter label="סריקות החודש" value={formatUsageValue(usage.scansUsed, usage.scansLimit, 'סריקות')} percent={scanPercent} />
        <UsageMeter label="בריכות פעילות" value={formatUsageValue(usage.activePoolsUsed, usage.activePoolLimit, 'בריכות פעילות')} percent={poolPercent} />
      </View>

      <Card compact style={styles.includedCard}>
        <Text style={styles.sectionTitle}>כלול במנוי</Text>
        <IncludedRow label="בריכה פעילה אחת" value={`${usage.includedPools} כלולה`} />
        <IncludedRow label="סריקות חודשיות" value={`${usage.includedScans} בחודש`} />
      </Card>

      <Card compact style={styles.includedCard}>
        <Text style={styles.sectionTitle}>תוספות זמינות</Text>
        <AddonRow title={PLAN_ADDONS.extraPool.name} subtitle={`+${PLAN_ADDONS.extraPool.priceIls} ₪ לחודש`} />
        <AddonRow title={PLAN_ADDONS.extraScans.name} subtitle={`+${PLAN_ADDONS.extraScans.priceIls} ₪ לחודש הנוכחי`} />
      </Card>

      <Pressable style={styles.backButton} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.backText}>חזרה להגדרות</Text>
      </Pressable>
    </AppShell>
  );
}

function UsageMeter({ label, percent, value }: { label: string; percent: number; value: string }) {
  return (
    <Card compact style={styles.usageCard}>
      <Text style={styles.usageLabel}>{label}</Text>
      <Text style={styles.usageValue}>{value}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%` }]} />
      </View>
    </Card>
  );
}

function IncludedRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.includedRow}>
      <Text style={styles.includedValue}>{value}</Text>
      <Text style={styles.includedLabel}>{label}</Text>
    </View>
  );
}

function AddonRow({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <View style={styles.addonRow}>
      <View style={styles.addonCopy}>
        <Text style={styles.addonTitle}>{title}</Text>
        <Text style={styles.addonSubtitle}>{subtitle}</Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 18,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 6,
    ...rtl.textCenter,
  },
  alertCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(240,165,41,0.35)',
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 16,
  },
  alertIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  alertCopy: { flex: 1 },
  alertTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  alertText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 4,
    ...rtl.text,
  },
  purchaseButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    ...shadows.button,
  },
  purchaseIcon: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  purchaseCopy: {
    flex: 1,
  },
  purchaseTitle: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    fontWeight: '900',
    ...rtl.text,
  },
  purchaseSubtitle: {
    color: colors.whiteMuted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 3,
    ...rtl.text,
  },
  planCard: {
    gap: 12,
    marginTop: 16,
  },
  planTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 14,
  },
  planIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 58,
    justifyContent: 'center',
    width: 58,
    ...shadows.button,
  },
  planCopy: { flex: 1 },
  planLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.text,
  },
  planName: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    fontWeight: '900',
    marginTop: 4,
    ...rtl.text,
  },
  planPrice: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 3,
    ...rtl.text,
  },
  metrics: {
    gap: 12,
    marginTop: 14,
  },
  usageCard: { gap: 9 },
  usageLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.text,
  },
  usageValue: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  progressTrack: {
    backgroundColor: colors.borderSoft,
    borderRadius: 4,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    height: '100%',
  },
  includedCard: {
    gap: 10,
    marginTop: 14,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  includedRow: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSoft,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'space-between',
    padding: 12,
  },
  includedLabel: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  includedValue: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  addonRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 12,
  },
  addonCopy: {
    flex: 1,
    gap: 3,
  },
  addonTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  addonSubtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  backButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 12,
  },
  backText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.86,
  },
});
