import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { colors, rtl, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolDetails'>;

export function PoolDetailsScreen({ navigation, route }: Props) {
  const { getPool } = usePools();
  const pool = getPool(route.params.poolId);

  if (!pool) {
    return (
      <Screen>
        <Header />
        <View style={styles.missing}>
          <Text style={styles.title}>הבריכה לא נמצאה</Text>
          <Text style={styles.subtitle}>ייתכן שהמידע נמחק מהזיכרון המקומי של האפליקציה.</Text>
          <AppButton label="חזרה לבריכות" onPress={() => navigation.navigate('PoolsList')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>פרטי בריכה</Text>
        <Text style={styles.heroTitle}>{pool.name}</Text>
        <Text style={styles.heroSubtitle}>
          {pool.volumeLiters.toLocaleString('he-IL')} ליטר · בריכה מלבנית
        </Text>
      </View>

      <View style={styles.section}>
        <Card>
          <Text style={styles.cardLabel}>מידות</Text>
          <Text style={styles.cardValue}>
            {pool.lengthMeters} × {pool.widthMeters} × {pool.averageDepthMeters} מטר
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardLabel}>בדיקה אחרונה</Text>
          <Text style={styles.cardValue}>עדיין לא בוצעה בדיקת מים</Text>
        </Card>

        {pool.notes ? (
          <Card>
            <Text style={styles.cardLabel}>הערות</Text>
            <Text style={styles.notes}>{pool.notes}</Text>
          </Card>
        ) : null}
      </View>

      <View style={styles.actions}>
        <AppButton
          label="בחירת סטיק לסריקה"
          onPress={() => navigation.navigate('SelectStrip', { poolId: pool.id })}
        />
        <AppButton label="צפייה בהיסטוריה בהמשך" variant="secondary" onPress={() => undefined} />
        <AppButton label="חזרה לרשימה" variant="secondary" onPress={() => navigation.navigate('PoolsList')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  missing: {
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 30,
    marginTop: spacing.xxl,
    padding: spacing.lg,
  },
  eyebrow: {
    color: '#CFFAFE',
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.text,
  },
  heroTitle: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  heroSubtitle: {
    color: colors.whiteSoft,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '700',
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 28,
    fontWeight: '900',
    ...rtl.text,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: typography.lineHeights.body,
    ...rtl.text,
  },
  section: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cardLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  cardValue: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
    marginTop: spacing.xs,
    ...rtl.text,
  },
  notes: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: spacing.xs,
    ...rtl.text,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
