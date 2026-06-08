import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolDetails'>;

export function PoolDetailsScreen({ navigation, route }: Props) {
  const { getPool } = usePools();
  const pool = getPool(route.params.poolId);

  if (!pool) {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>הבריכה לא נמצאה</Text>
          <Text style={styles.subtitle}>ייתכן שהמידע נמחק מהזיכרון המקומי של האפליקציה.</Text>
          <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('PoolsList')}>
            <Text style={styles.primaryBtnLabel}>חזרה לבריכות</Text>
          </Pressable>
        </ScrollView>
        <BottomTabBar active="pools" navigation={navigation} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.blob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('PoolsList')}>
            <Text style={styles.iconGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>פרטי בריכה</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBubbleOne} />
          <View style={styles.heroBubbleTwo} />
          <View style={styles.heroBadge}><Text style={styles.heroBadgeGlyph}>💧</Text></View>
          <Text style={styles.heroTitle}>{pool.name}</Text>
          <Text style={styles.heroSub}>{pool.volumeLiters.toLocaleString('he-IL')} ליטר</Text>
          <View style={styles.pill}><Text style={styles.pillText}>מוכן לסריקה</Text></View>
        </View>

        <Pressable style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]} onPress={() => navigation.navigate('SelectStrip', { poolId: pool.id })}>
          <View style={styles.primaryIcon}><Text style={styles.primaryIconText}>⌖</Text></View>
          <Text style={styles.primaryBtnLabel}>התחל בדיקה לבריכה</Text>
        </Pressable>

        <View style={styles.metricGrid}>
          <Metric label="אורך" value={`${pool.lengthMeters} מ׳`} />
          <Metric label="רוחב" value={`${pool.widthMeters} מ׳`} />
          <Metric label="עומק" value={`${pool.averageDepthMeters} מ׳`} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardLabel}>בדיקה אחרונה</Text>
            <View style={styles.emptyBadge}><Text style={styles.emptyBadgeText}>טרם בוצעה</Text></View>
          </View>
          <Text style={styles.cardValue}>לאחר הסריקה הראשונה יוצגו כאן pH, כלור ואלקליניות.</Text>
        </View>

        {pool.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>הערות</Text>
            <Text style={styles.cardNotes}>{pool.notes}</Text>
          </View>
        ) : null}
      </ScrollView>

      <BottomTabBar active="pools" navigation={navigation} />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  blob: { position: 'absolute', top: -110, left: -90, width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(116,221,237,0.27)' },
  content: { paddingHorizontal: 20, paddingTop: 38, paddingBottom: 150, gap: spacing.md },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, borderRadius: 18, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', ...shadows.soft },
  iconGlyph: { fontSize: 27, color: colors.primaryDark, fontWeight: '900' },
  topTitle: { fontSize: 18, fontWeight: '900', color: colors.text, ...rtl.textCenter, flex: 1, fontFamily: typography.fontFamily },
  hero: { marginTop: 6, backgroundColor: colors.primary, borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', overflow: 'hidden', ...shadows.hero },
  heroBubbleOne: { position: 'absolute', width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.18)', top: -82, right: -40 },
  heroBubbleTwo: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.10)', bottom: -145, left: -64 },
  heroBadge: { width: 74, height: 74, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.20)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
  heroBadgeGlyph: { fontSize: 34 },
  heroTitle: { marginTop: 14, fontSize: 25, fontWeight: '900', color: colors.white, ...rtl.textCenter, fontFamily: typography.fontFamily },
  heroSub: { marginTop: 4, fontSize: 14, fontWeight: '800', color: 'rgba(255,255,255,0.78)', ...rtl.textCenter, fontFamily: typography.fontFamily },
  pill: { marginTop: spacing.md, paddingHorizontal: 15, paddingVertical: 7, borderRadius: radius.round, backgroundColor: 'rgba(255,255,255,0.20)' },
  pillText: { color: colors.white, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 2, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 12, ...shadows.card },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  primaryIcon: { width: 42, height: 42, borderRadius: 16, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  primaryIconText: { color: colors.white, fontSize: 23, fontWeight: '900' },
  primaryBtnLabel: { color: colors.primaryDeep, fontSize: 17, fontWeight: '900', fontFamily: typography.fontFamily },
  metricGrid: { flexDirection: 'row-reverse', gap: 10 },
  metricCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center', ...shadows.soft },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: '900', fontFamily: typography.fontFamily },
  metricLabel: { marginTop: 3, color: colors.muted, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, ...shadows.soft },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { color: colors.muted, fontSize: 13, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  emptyBadge: { backgroundColor: colors.warningSoft, borderRadius: radius.round, paddingHorizontal: 10, paddingVertical: 5 },
  emptyBadgeText: { color: colors.warning, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
  cardValue: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 10, ...rtl.text, fontFamily: typography.fontFamily },
  cardNotes: { color: colors.text, fontSize: 15, fontWeight: '700', lineHeight: 22, marginTop: 6, ...rtl.text, fontFamily: typography.fontFamily },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, ...rtl.textCenter, marginTop: 80, fontFamily: typography.fontFamily },
  subtitle: { fontSize: 14, fontWeight: '700', color: colors.muted, ...rtl.textCenter, marginTop: 8, fontFamily: typography.fontFamily },
});