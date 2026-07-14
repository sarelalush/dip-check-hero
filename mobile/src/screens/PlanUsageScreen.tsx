import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { BillingPurchasePanel } from '../components/BillingPurchasePanel';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PLAN_ADDONS, fetchPlanUsage, getFallbackPlanUsage, type PlanUsageInfo } from '../services/usageService';
import { useAuth } from '../state/AuthContext';
import { usePools } from '../state/PoolsContext';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PlanUsage'>;

function pct(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function formatUsageValue(used: number, limit: number, unit: string) {
  const count = `${used.toLocaleString('he-IL')} / ${limit.toLocaleString('he-IL')}`;
  return `‪${count}‬ ${unit}`;
}

export function PlanUsageScreen({ navigation, route }: Props) {
  const { accountId } = useAuth();
  const { pools } = usePools();
  const [usage, setUsage] = useState<PlanUsageInfo>(() => getFallbackPlanUsage(pools.length));
  const [loading, setLoading] = useState(true);
  const reason = route.params?.reason;

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
        <UsageMeter
          label="סריקות החודש"
          value={formatUsageValue(usage.scansUsed, usage.scansLimit, 'סריקות')}
          percent={scanPercent}
        />
        <UsageMeter
          label="בריכות פעילות"
          value={formatUsageValue(usage.activePoolsUsed, usage.activePoolLimit, 'בריכות פעילות')}
          percent={poolPercent}
        />
      </View>

      <Card compact style={styles.includedCard}>
        <Text style={styles.sectionTitle}>כלול במנוי</Text>
        <IncludedRow label="בריכה פעילה אחת" value={`${usage.includedPools} כלולה`} />
        <IncludedRow label="סריקות חודשיות" value={`${usage.includedScans} בחודש`} />
      </Card>

      <Card compact style={styles.includedCard}>
        <Text style={styles.sectionTitle}>תוספות</Text>
        <AddonRow title={PLAN_ADDONS.extraPool.name} subtitle={`+${PLAN_ADDONS.extraPool.priceIls} ₪ לחודש`} button="הוסף בריכה נוספת" />
        <AddonRow title={PLAN_ADDONS.extraScans.name} subtitle={`+${PLAN_ADDONS.extraScans.priceIls} ₪ לחודש הנוכחי`} button="רכוש עוד 200 סריקות" />
      </Card>

      <BillingPurchasePanel accountId={accountId} onPurchaseVerified={loadUsage} />

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

function AddonRow({ button, subtitle, title }: { button: string; subtitle: string; title: string }) {
  return (
    <View style={styles.addonRow}>
      <View style={styles.addonCopy}>
        <Text style={styles.addonTitle}>{title}</Text>
        <Text style={styles.addonSubtitle}>{subtitle}</Text>
      </View>
      <View style={styles.comingSoonButton}>
        <Text style={styles.comingSoonText}>{button} · בקרוב</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 18,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  alertCard: {
    marginTop: 16,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(240,165,41,0.35)',
    borderWidth: 1,
  },
  alertIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    ...rtl.text,
  },
  planCard: {
    marginTop: 16,
    gap: 12,
  },
  planTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  planIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
    marginTop: 4,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 20,
    fontWeight: '900',
    ...rtl.text,
  },
  planPrice: {
    marginTop: 3,
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  metrics: {
    marginTop: 14,
    gap: 12,
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
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.borderSoft,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  includedCard: {
    marginTop: 14,
    gap: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  includedRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    gap: 10,
  },
  includedLabel: {
    flex: 1,
    color: colors.text,
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
    borderRadius: 16,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
    gap: 10,
  },
  addonCopy: { gap: 3 },
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
  comingSoonButton: {
    borderRadius: radius.round,
    backgroundColor: colors.primarySoft,
    paddingVertical: 10,
    alignItems: 'center',
  },
  comingSoonText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
  },
  backButton: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
});
