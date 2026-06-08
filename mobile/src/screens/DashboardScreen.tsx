import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

export function DashboardScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <View style={styles.root}>
      <View style={styles.waterBlobOne} />
      <View style={styles.waterBlobTwo} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.circleBtn}>
            <Text style={styles.circleBtnGlyph}>⚙︎</Text>
          </Pressable>
          <View style={styles.brand}>
            <Text style={styles.brandName}>Dip Check</Text>
            <View style={styles.brandDot}><Text style={styles.brandDotGlyph}>💧</Text></View>
          </View>
          <Pressable onPress={() => navigation.navigate('History')} style={styles.circleBtn}>
            <Text style={styles.circleBtnGlyph}>◷</Text>
          </Pressable>
        </View>

        <View style={styles.heroIntro}>
          <Text style={styles.greeting}>שלום, המים מוכנים לבדיקה</Text>
          <Text style={styles.greetingSub}>צילום סטיק, תוצאה ברורה והמלצה לפעולה — בלי לנחש.</Text>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusBadge}><Text style={styles.statusBadgeText}>מאוזן</Text></View>
            <Text style={styles.statusTitle}>מצב המים</Text>
          </View>

          <View style={styles.bigStatusCircle}>
            <View style={styles.innerStatusCircle}>
              <Text style={styles.statusCheck}>✓</Text>
            </View>
          </View>

          <Text style={styles.statusHeadline}>הכול נראה טוב</Text>
          <Text style={styles.statusHint}>הערכים הבאים הם דוגמה עד שתבוצע סריקה אמיתית</Text>

          <View style={styles.statRow}>
            <StatBlock label="אלקליניות" value="120" unit="ppm" tone="ok" />
            <StatBlock label="כלור" value="1.5" unit="ppm" tone="ok" />
            <StatBlock label="pH" value="7.3" unit="" tone="ok" />
          </View>
        </View>

        <Pressable onPress={() => navigation.navigate('SelectStrip')} style={({ pressed }) => [styles.scanCta, pressed && styles.pressed]}>
          <View style={styles.scanIcon}><Text style={styles.scanIconText}>⌖</Text></View>
          <View style={styles.scanCopy}>
            <Text style={styles.scanTitle}>התחל סריקה חדשה</Text>
            <Text style={styles.scanSubtitle}>בחר סטיק, צלם וקבל תוצאה</Text>
          </View>
        </Pressable>

        <View style={styles.quickGrid}>
          <QuickCard title="בריכות" value={pools.length ? `${pools.length}` : '0'} hint="ניהול בריכות" onPress={() => navigation.navigate('PoolsList')} />
          <QuickCard title="היסטוריה" value="—" hint="בדיקות קודמות" onPress={() => navigation.navigate('History')} />
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>טיפ לבדיקה מדויקת</Text>
          <Text style={styles.tipText}>צלם את הסטיק באור טבעי, על רקע בהיר, ובצע את הסריקה בזמן שמוגדר על האריזה.</Text>
        </View>
      </ScrollView>

      <BottomTabBar active="home" navigation={navigation} />
    </View>
  );
}

function StatBlock({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: 'ok' | 'low' | 'high' }) {
  const bg = tone === 'ok' ? colors.successSoft : tone === 'low' ? colors.warningSoft : colors.dangerSoft;
  const fg = tone === 'ok' ? colors.success : tone === 'low' ? colors.warning : colors.danger;
  const txt = tone === 'ok' ? 'תקין' : tone === 'low' ? 'נמוך' : 'גבוה';
  return (
    <View style={[styles.statBlock, { backgroundColor: bg }]}> 
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {unit ? <Text style={styles.statUnit}>{unit}</Text> : <Text style={styles.statUnit}>ערך</Text>}
      <Text style={[styles.statTone, { color: fg }]}>{txt}</Text>
    </View>
  );
}

function QuickCard({ title, value, hint, onPress }: { title: string; value: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}>
      <Text style={styles.quickValue}>{value}</Text>
      <Text style={styles.quickTitle}>{title}</Text>
      <Text style={styles.quickHint}>{hint}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  waterBlobOne: {
    position: 'absolute', top: -110, right: -80, width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(116,221,237,0.35)',
  },
  waterBlobTwo: {
    position: 'absolute', top: 180, left: -120, width: 240, height: 240, borderRadius: 120,
    backgroundColor: 'rgba(6,168,199,0.14)',
  },
  content: { paddingHorizontal: 20, paddingTop: 26, paddingBottom: 150 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  circleBtn: { width: 44, height: 44, borderRadius: 18, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', ...shadows.soft },
  circleBtnGlyph: { fontSize: 19, color: colors.primaryDark, fontWeight: '900' },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  brandName: { color: colors.primaryDeep, fontSize: 18, fontWeight: '900', fontFamily: typography.fontFamily, letterSpacing: 0.2 },
  brandDot: { width: 38, height: 38, borderRadius: 15, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.soft },
  brandDotGlyph: { fontSize: 18 },
  heroIntro: { marginTop: 26 },
  greeting: { fontSize: 31, lineHeight: 38, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  greetingSub: { marginTop: 8, fontSize: 15, lineHeight: 23, color: colors.muted, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  statusCard: { marginTop: 22, backgroundColor: colors.cardSoft, borderRadius: radius.xxl, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.86)', ...shadows.card },
  statusHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  statusTitle: { color: colors.textSoft, fontWeight: '900', fontSize: 15, fontFamily: typography.fontFamily },
  statusBadge: { backgroundColor: colors.successSoft, borderRadius: radius.round, paddingHorizontal: 12, paddingVertical: 6 },
  statusBadgeText: { color: colors.success, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamily },
  bigStatusCircle: { marginTop: 18, width: 116, height: 116, borderRadius: 58, backgroundColor: '#DDF7FC', alignItems: 'center', justifyContent: 'center' },
  innerStatusCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.successSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 8, borderColor: colors.white },
  statusCheck: { color: colors.success, fontSize: 46, fontWeight: '900' },
  statusHeadline: { marginTop: 14, fontSize: 22, fontWeight: '900', color: colors.text, fontFamily: typography.fontFamily },
  statusHint: { marginTop: 5, fontSize: 12, color: colors.muted, fontWeight: '700', fontFamily: typography.fontFamily, ...rtl.textCenter },
  statRow: { marginTop: 18, flexDirection: 'row-reverse', gap: 10, alignSelf: 'stretch' },
  statBlock: { flex: 1, borderRadius: 21, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  statLabel: { fontSize: 11, fontWeight: '900', color: colors.muted, fontFamily: typography.fontFamily },
  statValue: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 2, fontFamily: typography.fontFamily },
  statUnit: { fontSize: 10, color: colors.muted, fontWeight: '800', fontFamily: typography.fontFamily },
  statTone: { fontSize: 11, fontWeight: '900', marginTop: 4, fontFamily: typography.fontFamily },
  scanCta: { marginTop: 20, backgroundColor: colors.primary, borderRadius: radius.xl, padding: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, ...shadows.button },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  scanIcon: { width: 54, height: 54, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  scanIconText: { color: colors.white, fontSize: 28, fontWeight: '900' },
  scanCopy: { flex: 1 },
  scanTitle: { color: colors.white, fontSize: 18, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  scanSubtitle: { marginTop: 3, color: 'rgba(255,255,255,0.78)', fontSize: 13, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  quickGrid: { marginTop: 16, flexDirection: 'row-reverse', gap: 12 },
  quickCard: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.md, ...shadows.soft },
  quickValue: { fontSize: 26, fontWeight: '900', color: colors.primaryDeep, ...rtl.text, fontFamily: typography.fontFamily },
  quickTitle: { marginTop: 6, fontSize: 15, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  quickHint: { marginTop: 3, fontSize: 12, color: colors.muted, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  tipCard: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  tipTitle: { color: colors.text, fontSize: 15, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  tipText: { marginTop: 6, color: colors.muted, fontSize: 13, lineHeight: 21, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
});