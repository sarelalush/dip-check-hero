import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { colors, radius, rtl, spacing, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PoolsList'>;

export function PoolsListScreen({ navigation }: Props) {
  const { pools } = usePools();

  return (
    <Screen>
      <Header />
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>הבריכות שלי</Text>
        <Text style={styles.title}>ניהול בריכות</Text>
        <Text style={styles.subtitle}>
          שמרו את נתוני הבריכה כדי שבהמשך נוכל לחשב מינונים מדויקים לפי נפח המים.
        </Text>
      </View>

      <View style={styles.actions}>
        <AppButton label="הוספת בריכה חדשה" onPress={() => navigation.navigate('AddPool')} />
      </View>

      <View style={styles.list}>
        {pools.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>עדיין אין בריכות שמורות</Text>
            <Text style={styles.emptyText}>
              הוסיפו בריכה ראשונה כדי להתחיל לבנות את בסיס הנתונים המקומי של האפליקציה.
            </Text>
          </Card>
        ) : (
          pools.map((pool) => (
            <Pressable
              key={pool.id}
              onPress={() => navigation.navigate('PoolDetails', { poolId: pool.id })}
              style={({ pressed }: { pressed: boolean }) => pressed && styles.pressed}
            >
              <Card style={styles.poolCard}>
                <View style={styles.iconBadge}>
                  <Text style={styles.iconText}>מים</Text>
                </View>
                <View style={styles.poolText}>
                  <Text style={styles.poolName}>{pool.name}</Text>
                  <Text style={styles.poolMeta}>
                    {pool.volumeLiters.toLocaleString('he-IL')} ליטר · מלבנית
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.footerAction}>
        <AppButton label="חזרה לדשבורד" variant="secondary" onPress={() => navigation.navigate('Dashboard')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: spacing.xxl,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.text,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  actions: {
    marginTop: spacing.lg,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.text,
  },
  emptyText: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  poolCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  iconText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
  },
  poolText: {
    flex: 1,
  },
  poolName: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    ...rtl.text,
  },
  poolMeta: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
    ...rtl.text,
  },
  footerAction: {
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
