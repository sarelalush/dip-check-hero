import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolsList'>;

export function PoolsListScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <View style={styles.root}>
      <View style={styles.waterBlob} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.navigate('AddPool')} style={styles.addMiniButton}>
            <Text style={styles.addMiniGlyph}>+</Text>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>ניהול בריכות</Text>
            <Text style={styles.title}>הבריכות שלי</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroOverlayOne} />
          <View style={styles.heroOverlayTwo} />
          <Text style={styles.heroIcon}>💧</Text>
          <Text style={styles.heroTitle}>כל הבריכות במקום אחד</Text>
          <Text style={styles.heroSub}>הגדר נפח, בצע סריקה וקבל המלצות מדויקות לכל בריכה.</Text>
        </View>

        <Pressable onPress={() => navigation.navigate('AddPool')} style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}>
          <View style={styles.addIcon}><Text style={styles.addIconText}>+</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.addLabel}>הוספת בריכה חדשה</Text>
            <Text style={styles.addHint}>נפח, מידות והגדרות טיפול</Text>
          </View>
        </Pressable>

        <View style={styles.list}>
          {pools.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>≈</Text>
              <Text style={styles.emptyTitle}>עדיין אין בריכות</Text>
              <Text style={styles.emptyText}>הוסף את הבריכה הראשונה כדי להתחיל לבנות היסטוריית בדיקות.</Text>
            </View>
          ) : (
            pools.map((pool, index) => (
              <Pressable
                key={pool.id}
                onPress={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.poolVisual}>
                  <View style={styles.waveOne} />
                  <View style={styles.waveTwo} />
                  <Text style={styles.poolVisualIcon}>{index % 2 === 0 ? '🏊' : '💦'}</Text>
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHead}>
                    <Text style={styles.menuDots}>⋯</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.poolName}>{pool.name}</Text>
                      <Text style={styles.poolMeta}>{pool.volumeLiters.toLocaleString('he-IL')} ליטר</Text>
                    </View>
                  </View>
                  <View style={styles.statusRow}>
                    <View style={styles.statusPill}><Text style={styles.statusText}>מים מאוזנים</Text></View>
                    <Text style={styles.nextText}>פתח ‹</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <BottomTabBar active="pools" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, overflow: 'hidden' },
  waterBlob: { position: 'absolute', top: -100, right: -110, width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(116,221,237,0.34)' },
  content: { paddingHorizontal: 20, paddingTop: 34, paddingBottom: 150 },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { flex: 1 },
  kicker: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  title: { marginTop: 3, fontSize: 31, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  addMiniButton: { width: 46, height: 46, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', ...shadows.button },
  addMiniGlyph: { color: colors.white, fontSize: 28, fontWeight: '900', marginTop: -2 },
  heroCard: { marginTop: 22, minHeight: 154, borderRadius: radius.xxl, padding: 20, overflow: 'hidden', backgroundColor: colors.primary, ...shadows.hero },
  heroOverlayOne: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.18)', top: -70, right: -28 },
  heroOverlayTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.12)', bottom: -105, left: -44 },
  heroIcon: { fontSize: 32, textAlign: 'right' },
  heroTitle: { marginTop: 10, color: colors.white, fontSize: 22, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  heroSub: { marginTop: 6, color: 'rgba(255,255,255,0.82)', fontSize: 13, lineHeight: 21, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  addBtn: { marginTop: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.xl, padding: 16, ...shadows.card },
  pressed: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  addIcon: { width: 48, height: 48, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  addIconText: { color: colors.primaryDark, fontSize: 26, fontWeight: '900', marginTop: -2 },
  addLabel: { color: colors.text, fontSize: 16, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  addHint: { marginTop: 3, color: colors.muted, fontSize: 12, fontWeight: '700', ...rtl.text, fontFamily: typography.fontFamily },
  list: { marginTop: 18, gap: 16 },
  empty: { backgroundColor: colors.cardSoft, borderRadius: radius.xl, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadows.card },
  emptyIcon: { fontSize: 36, color: colors.primary },
  emptyTitle: { marginTop: 8, color: colors.text, textAlign: 'center', fontWeight: '900', fontSize: 18, fontFamily: typography.fontFamily },
  emptyText: { marginTop: 6, color: colors.muted, textAlign: 'center', fontWeight: '700', fontSize: 13, lineHeight: 20, fontFamily: typography.fontFamily },
  card: { backgroundColor: colors.card, borderRadius: radius.xl, overflow: 'hidden', ...shadows.card },
  poolVisual: { height: 126, backgroundColor: colors.primary, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  waveOne: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.22)', top: -120, right: -40 },
  waveTwo: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,255,255,0.12)', bottom: -160, left: -40 },
  poolVisualIcon: { fontSize: 42 },
  cardBody: { padding: 16 },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  menuDots: { color: colors.muted, fontSize: 22, fontWeight: '900', marginTop: -6 },
  poolName: { color: colors.text, fontSize: 19, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  poolMeta: { marginTop: 4, color: colors.muted, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  statusRow: { marginTop: 14, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  statusPill: { backgroundColor: colors.successSoft, borderRadius: radius.round, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { color: colors.success, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamily },
  nextText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamily },
});