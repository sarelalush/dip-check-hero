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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={styles.circleBtn}><Text style={styles.circleBtnGlyph}>🔔</Text></View>
          <View style={styles.brand}>
            <Text style={styles.brandName}>AquaSense</Text>
            <View style={styles.brandDot}><Text style={styles.brandDotGlyph}>💧</Text></View>
          </View>
          <View style={styles.circleBtn}><Text style={styles.circleBtnGlyph}>≡</Text></View>
        </View>

        <Text style={styles.greeting}>שלום דני!</Text>
        <Text style={styles.greetingSub}>כיף לראות אותך שוב</Text>

        <View style={styles.statusCard}>
          <Text style={styles.statusTitle}>מצב המים</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusCheck}>✓</Text>
          </View>
          <Text style={styles.statusHeadline}>רוב הערכים תקינים</Text>
          <Text style={styles.statusHint}>💧 המים שלך נקיים ובריאים</Text>

          <View style={styles.statRow}>
            <StatBlock label="אלקליניות" value="120" tone="ok" />
            <StatBlock label="כלור" value="1.5" tone="ok" />
            <StatBlock label="pH" value="7.3" tone="ok" />
          </View>
        </View>

        <CTAButton onPress={() => navigation.navigate('SelectStrip')} />

        {pools.length > 0 && (
          <Text style={styles.poolsLink} onPress={() => navigation.navigate('PoolsList')}>
            צפה בכל הבריכות שלי ({pools.length}) ‹
          </Text>
        )}
      </ScrollView>

      <BottomTabBar active="home" navigation={navigation} />
    </View>
  );
}

function StatBlock({ label, value, tone }: { label: string; value: string; tone: 'ok' | 'low' | 'high' }) {
  const bg = tone === 'ok' ? '#ECFDF5' : tone === 'low' ? '#FEF3C7' : '#FEE2E2';
  const fg = tone === 'ok' ? '#059669' : tone === 'low' ? '#B45309' : '#DC2626';
  const txt = tone === 'ok' ? 'תקין' : tone === 'low' ? 'נמוך' : 'גבוה';
  return (
    <View style={[styles.statBlock, { backgroundColor: bg }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={[styles.statTone, { color: fg }]}>{txt}</Text>
    </View>
  );
}

function CTAButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}>
      <Text style={styles.ctaGlyph}>⌗</Text>
      <Text style={styles.ctaLabel}>התחל סריקה</Text>
    </Pressable>
  );
}



const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 140 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  circleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center', ...shadows.card },
  circleBtnGlyph: { fontSize: 18, color: colors.text },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  brandName: { color: colors.primary, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily, letterSpacing: 0.5 },
  brandDot: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandDotGlyph: { fontSize: 18 },
  greeting: { marginTop: 24, fontSize: 30, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  greetingSub: { marginTop: 4, fontSize: 14, color: colors.muted, ...rtl.text, fontFamily: typography.fontFamily },
  statusCard: { marginTop: 18, backgroundColor: colors.card, borderRadius: 28, padding: 20, alignItems: 'center', ...shadows.card },
  statusTitle: { color: colors.muted, fontWeight: '800', fontSize: 13, fontFamily: typography.fontFamily },
  statusBadge: { marginTop: 14, width: 80, height: 80, borderRadius: 40, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' },
  statusCheck: { color: '#10B981', fontSize: 44, fontWeight: '900' },
  statusHeadline: { marginTop: 12, fontSize: 20, fontWeight: '900', color: colors.text, fontFamily: typography.fontFamily },
  statusHint: { marginTop: 4, fontSize: 12, color: colors.muted, fontWeight: '700', fontFamily: typography.fontFamily },
  statRow: { marginTop: 18, flexDirection: 'row-reverse', gap: 10, alignSelf: 'stretch' },
  statBlock: { flex: 1, borderRadius: 18, paddingVertical: 12, alignItems: 'center' },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.muted, fontFamily: typography.fontFamily },
  statValue: { fontSize: 22, fontWeight: '900', color: colors.text, marginTop: 2, fontFamily: typography.fontFamily },
  statTone: { fontSize: 11, fontWeight: '900', marginTop: 2, fontFamily: typography.fontFamily },
  cta: { marginTop: 22, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, paddingVertical: 18, borderRadius: radius.round, ...shadows.button },
  ctaGlyph: { color: colors.white, fontSize: 22, fontWeight: '900' },
  ctaLabel: { color: colors.white, fontSize: 18, fontWeight: '900', fontFamily: typography.fontFamily },
  poolsLink: { marginTop: 14, textAlign: 'center', color: colors.primary, fontWeight: '900', fontSize: 12, fontFamily: typography.fontFamily },
});
