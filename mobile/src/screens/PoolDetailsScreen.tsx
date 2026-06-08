import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { colors, radius, rtl, spacing, typography } from '../theme';
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
          <Text style={styles.heading}>הבריכה לא נמצאה</Text>
          <Text style={styles.sub}>ייתכן שהמידע נמחק מהזיכרון המקומי של האפליקציה.</Text>
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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('PoolsList')}>
            <Text style={styles.iconGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.title}>{pool.name}</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeGlyph}>💧</Text></View>
          <Text style={styles.heroTitle}>{pool.name}</Text>
          <Text style={styles.heroSub}>{pool.volumeLiters.toLocaleString('he-IL')} ליטר</Text>
          <View style={styles.pill}><Text style={styles.pillText}>מים מאוזנים</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>מידות</Text>
          <Text style={styles.cardValue}>
            {pool.lengthMeters} × {pool.widthMeters} × {pool.averageDepthMeters} מטר
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>בדיקה אחרונה</Text>
          <Text style={styles.cardValue}>עדיין לא בוצעה בדיקת מים</Text>
        </View>

        {pool.notes ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>הערות</Text>
            <Text style={styles.cardNotes}>{pool.notes}</Text>
          </View>
        ) : null}

        <Pressable style={styles.primaryBtn} onPress={() => navigation.navigate('SelectStrip', { poolId: pool.id })}>
          <Text style={styles.primaryBtnGlyph}>⌗</Text>
          <Text style={styles.primaryBtnLabel}>בחירת סטיק לסריקה</Text>
        </Pressable>
      </ScrollView>

      <BottomTabBar active="pools" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F2F8FB' },
  content: { padding: spacing.lg, paddingTop: 60, paddingBottom: 120, gap: spacing.md },
  topBar: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0F2840', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
  },
  iconGlyph: { fontSize: 26, color: colors.text, fontWeight: '900' },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, ...rtl.textCenter, flex: 1 },
  hero: {
    backgroundColor: colors.white, borderRadius: 28, padding: spacing.xl,
    alignItems: 'center', gap: spacing.sm,
    shadowColor: '#0F2840', shadowOpacity: 0.08, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  heroBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#E0F7FA', alignItems: 'center', justifyContent: 'center',
  },
  heroBadgeGlyph: { fontSize: 34 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text, ...rtl.textCenter },
  heroSub: { fontSize: 14, fontWeight: '600', color: colors.muted, ...rtl.textCenter },
  pill: {
    marginTop: spacing.xs,
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  pillText: { color: '#059669', fontSize: 13, fontWeight: '800' },
  card: {
    backgroundColor: colors.white, borderRadius: 22, padding: spacing.lg,
    shadowColor: '#0F2840', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  cardLabel: { color: colors.muted, fontSize: 13, fontWeight: '800', ...rtl.text },
  cardValue: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 4, ...rtl.text },
  cardNotes: { color: colors.text, fontSize: 15, fontWeight: '600', lineHeight: 22, marginTop: 4, ...rtl.text },
  heading: { fontSize: 22, fontWeight: '900', color: colors.text, ...rtl.textCenter, marginTop: 80 },
  sub: { fontSize: 14, fontWeight: '600', color: colors.muted, ...rtl.textCenter, marginTop: 8 },
  primaryBtn: {
    marginTop: spacing.md,
    backgroundColor: '#0FB5C9', borderRadius: 999, paddingVertical: 16,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: '#0FB5C9', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
  primaryBtnGlyph: { color: colors.white, fontSize: 18, fontWeight: '900' },
  primaryBtnLabel: { color: colors.white, fontSize: 16, fontWeight: '900' },
});
