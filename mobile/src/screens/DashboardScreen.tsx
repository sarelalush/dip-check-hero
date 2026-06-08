import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, layout, radius, rtl, shadows, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <View style={styles.viewport}>
      <View style={styles.phoneShell}>
        <View style={styles.heroBackdrop}>
          <View style={styles.heroBubbleOne} />
          <View style={styles.heroBubbleTwo} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.navigate('Settings')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>⚙</Text>
            </Pressable>

            <View style={styles.logoWrap}>
              <View style={styles.logoMark}>
                <Text style={styles.logoDrop}>●</Text>
              </View>
              <View>
                <Text style={styles.logoName}>Dip Check</Text>
                <Text style={styles.logoSub}>בדיקת מים חכמה</Text>
              </View>
            </View>

            <Pressable onPress={() => navigation.navigate('History')} style={styles.headerButton}>
              <Text style={styles.headerButtonText}>◷</Text>
            </Pressable>
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroTopLine}>
              <View style={styles.livePill}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>מוכן לסריקה</Text>
              </View>
              <Text style={styles.heroOverline}>מצב הבריכה</Text>
            </View>

            <Text style={styles.heroTitle}>מים מאוזנים בלי לנחש</Text>
            <Text style={styles.heroSubtitle}>צלם סטיק בדיקה, קבל פענוח ברור והמלצה לפעולה תוך כמה שניות.</Text>

            <View style={styles.balanceRow}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreValue}>92</Text>
                <Text style={styles.scoreLabel}>איזון</Text>
              </View>

              <View style={styles.balanceCopy}>
                <Text style={styles.balanceTitle}>הכול נראה תקין</Text>
                <Text style={styles.balanceText}>הנתונים כרגע לדוגמה עד שתבוצע סריקה אמיתית.</Text>
              </View>
            </View>
          </View>

          <View style={styles.metricsRow}>
            <MetricCard label="pH" value="7.3" status="תקין" tone="ok" />
            <MetricCard label="כלור" value="1.5" status="ppm" tone="ok" />
            <MetricCard label="אלקליניות" value="120" status="ppm" tone="ok" />
          </View>

          <Pressable onPress={() => navigation.navigate('SelectStrip')} style={({ pressed }) => [styles.primaryScan, pressed && styles.pressed]}>
            <View style={styles.scanTextWrap}>
              <Text style={styles.primaryScanTitle}>התחל בדיקה חדשה</Text>
              <Text style={styles.primaryScanSub}>בחר סטיק, צלם וקבל תוצאות</Text>
            </View>
            <View style={styles.scanBadge}>
              <Text style={styles.scanBadgeText}>⌁</Text>
            </View>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>פעולות מהירות</Text>
            <Text style={styles.sectionHint}>ניהול הבריכה והבדיקות</Text>
          </View>

          <View style={styles.actionGrid}>
            <ActionCard title="בריכות" value={pools.length ? `${pools.length}` : '0'} hint="ניהול בריכות" icon="≈" onPress={() => navigation.navigate('PoolsList')} />
            <ActionCard title="היסטוריה" value="—" hint="בדיקות קודמות" icon="◷" onPress={() => navigation.navigate('History')} />
          </View>

          <View style={styles.tipCard}>
            <View style={styles.tipIcon}><Text style={styles.tipIconText}>i</Text></View>
            <View style={styles.tipCopy}>
              <Text style={styles.tipTitle}>טיפ לדיוק גבוה</Text>
              <Text style={styles.tipText}>צלם באור טבעי, על רקע בהיר, ואל תחכה מעבר לזמן שמופיע על האריזה.</Text>
            </View>
          </View>
        </ScrollView>

        <BottomTabBar active="home" navigation={navigation} />
      </View>
    </View>
  );
}

function MetricCard({ label, value, status, tone }: { label: string; value: string; status: string; tone: 'ok' | 'warn' | 'bad' }) {
  const toneColor = tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : colors.danger;
  const toneBg = tone === 'ok' ? colors.successSoft : tone === 'warn' ? colors.warningSoft : colors.dangerSoft;

  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <View style={[styles.metricPill, { backgroundColor: toneBg }]}>
        <Text style={[styles.metricPillText, { color: toneColor }]}>{status}</Text>
      </View>
    </View>
  );
}

function ActionCard({ title, value, hint, icon, onPress }: { title: string; value: string; hint: string; icon: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}>
      <View style={styles.actionTop}>
        <View style={styles.actionIcon}><Text style={styles.actionIconText}>{icon}</Text></View>
        <Text style={styles.actionValue}>{value}</Text>
      </View>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
  },
  phoneShell: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxPhoneWidth,
    backgroundColor: colors.backgroundAlt,
    overflow: 'hidden',
  },
  heroBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 315,
    backgroundColor: colors.navy,
    borderBottomLeftRadius: 42,
    borderBottomRightRadius: 42,
  },
  heroBubbleOne: {
    position: 'absolute',
    top: -105,
    right: -76,
    width: 255,
    height: 255,
    borderRadius: 128,
    backgroundColor: 'rgba(112,221,234,0.22)',
  },
  heroBubbleTwo: {
    position: 'absolute',
    bottom: -55,
    left: -65,
    width: 175,
    height: 175,
    borderRadius: 88,
    backgroundColor: 'rgba(0,167,200,0.18)',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 146,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButtonText: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
  },
  logoWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.32)',
  },
  logoDrop: {
    color: colors.white,
    fontSize: 18,
  },
  logoName: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.text,
  },
  logoSub: {
    marginTop: 1,
    color: 'rgba(255,255,255,0.68)',
    fontFamily: typography.fontFamily,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.text,
  },
  heroCard: {
    marginTop: 28,
    backgroundColor: colors.white,
    borderRadius: 34,
    padding: 22,
    ...shadows.hero,
  },
  heroTopLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroOverline: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  livePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  liveText: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  heroTitle: {
    marginTop: 18,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '900',
    ...rtl.text,
  },
  heroSubtitle: {
    marginTop: 8,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '700',
    ...rtl.text,
  },
  balanceRow: {
    marginTop: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 16,
  },
  scoreCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.primarySoft,
    borderWidth: 10,
    borderColor: '#F6FEFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    color: colors.primaryDeep,
    fontSize: 31,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    lineHeight: 34,
  },
  scoreLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  balanceCopy: {
    flex: 1,
  },
  balanceTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  balanceText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  metricsRow: {
    marginTop: 18,
    flexDirection: 'row-reverse',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  metricLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  metricValue: {
    marginTop: 5,
    color: colors.text,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  metricPill: {
    marginTop: 8,
    borderRadius: radius.round,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  metricPillText: {
    fontSize: 10,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  primaryScan: {
    marginTop: 18,
    minHeight: 74,
    borderRadius: 28,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    ...shadows.button,
  },
  scanTextWrap: {
    flex: 1,
  },
  primaryScanTitle: {
    color: colors.white,
    fontSize: 19,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  primaryScanSub: {
    marginTop: 4,
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  scanBadge: {
    width: 54,
    height: 54,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.20)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBadgeText: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '900',
  },
  sectionHeader: {
    marginTop: 22,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  sectionHint: {
    marginTop: 3,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  actionGrid: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: spacing.md,
    minHeight: 125,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  actionTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconText: {
    color: colors.primaryDeep,
    fontSize: 19,
    fontWeight: '900',
  },
  actionValue: {
    color: colors.primaryDeep,
    fontSize: 26,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
  },
  actionTitle: {
    marginTop: 14,
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  actionHint: {
    marginTop: 4,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  tipCard: {
    marginTop: 16,
    backgroundColor: '#F7FDFF',
    borderRadius: 26,
    padding: spacing.md,
    flexDirection: 'row-reverse',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tipIcon: {
    width: 36,
    height: 36,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipIconText: {
    color: colors.primaryDeep,
    fontWeight: '900',
    fontSize: 16,
  },
  tipCopy: {
    flex: 1,
  },
  tipTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  tipText: {
    marginTop: 5,
    color: colors.muted,
    fontSize: 12.5,
    lineHeight: 20,
    fontWeight: '700',
    fontFamily: typography.fontFamily,
    ...rtl.text,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
