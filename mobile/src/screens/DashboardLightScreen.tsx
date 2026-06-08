import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, layout, radius, rtl, shadows, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type Level = 'red' | 'yellow' | 'green';

export function DashboardLightScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <View style={styles.viewport}>
      <View style={styles.phone}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <Pressable onPress={() => navigation.navigate('Settings')} style={styles.circleButton}><Text style={styles.circleText}>≡</Text></Pressable>
            <View style={styles.brand}><View style={styles.logo}><Text style={styles.logoText}>●</Text></View><Text style={styles.brandText}>AquaSense</Text></View>
            <Pressable onPress={() => navigation.navigate('History')} style={styles.circleButton}><Text style={styles.circleText}>○</Text></Pressable>
          </View>

          <Text style={styles.greeting}>שלום Isarel190!</Text>
          <Text style={styles.subtitle}>כיף לראות אותך שוב</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>מצב המים</Text>
            <View style={styles.checkOuter}><View style={styles.checkInner}><Text style={styles.check}>✓</Text></View></View>
            <Text style={styles.cardTitle}>נדרש תיקון קל</Text>
            <Text style={styles.cardSubtitle}>המים שלך נקיים ובריאים</Text>
            <View style={styles.metrics}>
              <Metric label="pH" value="8.3" status="גבוה" level="red" />
              <Metric label="כלור" value="0.5" status="נמוך" level="yellow" />
              <Metric label="אלקליניות" value="180" status="גבוה" level="red" />
            </View>
          </View>

          <Pressable onPress={() => navigation.navigate('SelectStrip')} style={styles.mainButton}>
            <Text style={styles.mainButtonIcon}>□</Text>
            <Text style={styles.mainButtonText}>התחל סריקה</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('PoolsList')} style={styles.link}><Text style={styles.linkText}>צפה בכל הבריכות שלי ({pools.length}) ›</Text></Pressable>

          <View style={styles.quickArea}>
            <Text style={styles.sectionTitle}>פעולות מהירות</Text>
            <Text style={styles.sectionSub}>ניהול הבריכה והבדיקות</Text>
            <View style={styles.quickGrid}>
              <Quick title="בריכות" subtitle="ניהול בריכות" value={String(pools.length)} onPress={() => navigation.navigate('PoolsList')} />
              <Quick title="היסטוריה" subtitle="בדיקות קודמות" value="—" onPress={() => navigation.navigate('History')} />
            </View>
          </View>
        </ScrollView>
        <BottomTabBar active="home" navigation={navigation} />
      </View>
    </View>
  );
}

function Metric({ label, value, status, level }: { label: string; value: string; status: string; level: Level }) {
  const fg = level === 'green' ? colors.success : level === 'yellow' ? colors.warning : colors.danger;
  const bg = level === 'green' ? colors.successSoft : level === 'yellow' ? colors.warningSoft : colors.dangerSoft;
  const border = level === 'green' ? '#B9EFD8' : level === 'yellow' ? '#F8D77C' : '#F8C3CD';
  return <View style={[styles.metric, { borderColor: border }]}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text><View style={[styles.metricPill, { backgroundColor: bg }]}><Text style={[styles.metricStatus, { color: fg }]}>{status}</Text></View></View>;
}

function Quick({ title, subtitle, value, onPress }: { title: string; subtitle: string; value: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.quickCard}><View style={styles.quickTop}><View style={styles.quickIcon}><Text style={styles.quickIconText}>≈</Text></View><Text style={styles.quickValue}>{value}</Text></View><Text style={styles.quickTitle}>{title}</Text><Text style={styles.quickSubtitle}>{subtitle}</Text></Pressable>;
}

const styles = StyleSheet.create({
  viewport: { flex: 1, alignItems: 'center', backgroundColor: colors.backgroundAlt },
  phone: { flex: 1, width: '100%', maxWidth: layout.maxPhoneWidth, backgroundColor: colors.background, overflow: 'hidden' },
  glowTop: { position: 'absolute', top: -90, right: -70, width: 230, height: 230, borderRadius: 115, backgroundColor: 'rgba(95,203,225,0.22)' },
  glowBottom: { position: 'absolute', bottom: 80, left: -120, width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.55)' },
  content: { paddingHorizontal: 28, paddingTop: 16, paddingBottom: 132 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  circleButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.whiteSoft, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', ...shadows.soft },
  circleText: { color: colors.text, fontSize: 20, fontWeight: '900' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 15 },
  brandText: { color: colors.primaryDeep, fontFamily: typography.fontFamily, fontSize: 16, fontWeight: '900' },
  greeting: { marginTop: 22, color: colors.text, fontFamily: typography.fontFamily, fontSize: 27, lineHeight: 34, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 3, color: colors.muted, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '700', ...rtl.text },
  card: { marginTop: 20, backgroundColor: colors.card, borderRadius: 28, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, alignItems: 'center', ...shadows.card },
  cardLabel: { color: colors.textSoft, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '900' },
  checkOuter: { marginTop: 18, width: 78, height: 78, borderRadius: 39, backgroundColor: '#FFF3B8', alignItems: 'center', justifyContent: 'center' },
  checkInner: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#FDE68A', borderWidth: 4, borderColor: colors.warning, alignItems: 'center', justifyContent: 'center' },
  check: { color: colors.warning, fontSize: 28, fontWeight: '900', lineHeight: 30 },
  cardTitle: { marginTop: 18, color: colors.text, fontFamily: typography.fontFamily, fontSize: 24, lineHeight: 30, fontWeight: '900', ...rtl.textCenter },
  cardSubtitle: { marginTop: 5, color: colors.textSoft, fontFamily: typography.fontFamily, fontSize: 14, fontWeight: '800', ...rtl.textCenter },
  metrics: { marginTop: 22, flexDirection: 'row-reverse', gap: 10, alignSelf: 'stretch' },
  metric: { flex: 1, minHeight: 94, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  metricLabel: { color: colors.textSoft, fontFamily: typography.fontFamily, fontSize: 12, fontWeight: '900' },
  metricValue: { marginTop: 5, color: colors.text, fontFamily: typography.fontFamily, fontSize: 24, lineHeight: 28, fontWeight: '900' },
  metricPill: { marginTop: 7, borderRadius: radius.round, paddingHorizontal: 9, paddingVertical: 4 },
  metricStatus: { fontFamily: typography.fontFamily, fontSize: 11, fontWeight: '900' },
  mainButton: { marginTop: 22, minHeight: 64, borderRadius: 32, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12, ...shadows.button },
  mainButtonIcon: { color: colors.white, fontSize: 24, fontWeight: '900' },
  mainButtonText: { color: colors.white, fontFamily: typography.fontFamily, fontSize: 18, fontWeight: '900' },
  link: { marginTop: 12, alignItems: 'center' },
  linkText: { color: colors.primaryDeep, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '800', ...rtl.textCenter },
  quickArea: { marginTop: 104 },
  sectionTitle: { color: colors.text, fontFamily: typography.fontFamily, fontSize: 22, fontWeight: '900', ...rtl.text },
  sectionSub: { marginTop: 3, color: colors.muted, fontFamily: typography.fontFamily, fontSize: 14, fontWeight: '800', ...rtl.text },
  quickGrid: { marginTop: 16, flexDirection: 'row-reverse', gap: 14 },
  quickCard: { flex: 1, minHeight: 126, borderRadius: 24, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 16, ...shadows.soft },
  quickTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  quickIcon: { width: 42, height: 42, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quickIconText: { color: colors.primaryDeep, fontSize: 20, fontWeight: '900' },
  quickValue: { color: colors.text, fontFamily: typography.fontFamily, fontSize: 26, fontWeight: '900' },
  quickTitle: { marginTop: 18, color: colors.text, fontFamily: typography.fontFamily, fontSize: 16, fontWeight: '900', ...rtl.text },
  quickSubtitle: { marginTop: 4, color: colors.muted, fontFamily: typography.fontFamily, fontSize: 13, fontWeight: '800', ...rtl.text },
});
