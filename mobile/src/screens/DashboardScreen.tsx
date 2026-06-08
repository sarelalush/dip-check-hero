import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { colors, rtl, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

const plannedActions = [
  { label: 'בחירת סטיק בדיקה', enabled: false },
  { label: 'הוספת בריכה', enabled: true },
  { label: 'צפייה בהיסטוריה', enabled: false },
];

export function DashboardScreen({ navigation }: Props) {
  return (
    <Screen>
      <Header />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>מחובר</Text>
        <Text style={styles.title}>החשבון מוכן להמשך</Text>
        <Text style={styles.subtitle}>
          זהו מסך זמני שמראה את הכיוון הבא באפליקציה. עדיין אין חיבור ל-Supabase או לפיצ׳רים מתקדמים.
        </Text>
      </View>

      <View style={styles.list}>
        {plannedActions.map((action, index) => (
          <Pressable
            key={action.label}
            disabled={!action.enabled}
            onPress={() => navigation.navigate('PoolsList')}
            style={({ pressed }: { pressed: boolean }) => pressed && styles.pressed}
          >
            <Card style={[styles.actionCard, !action.enabled && styles.disabledCard]}>
              <Text style={styles.actionIndex}>{index + 1}</Text>
              <View style={styles.actionCopy}>
                <Text style={styles.actionText}>{action.label}</Text>
                <Text style={styles.actionHint}>{action.enabled ? 'פתיחה עכשיו' : 'יתווסף בהמשך'}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>

      <View style={styles.footerAction}>
        <AppButton label="חזרה למסך הפתיחה" variant="secondary" onPress={() => navigation.popToTop()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  title: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  subtitle: {
    color: colors.whiteSoft,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  list: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  actionIndex: {
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '900',
    height: 36,
    lineHeight: 36,
    overflow: 'hidden',
    textAlign: 'center',
    width: 36,
  },
  actionText: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '900',
    ...rtl.text,
  },
  actionCopy: {
    flex: 1,
  },
  actionHint: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
    ...rtl.text,
  },
  disabledCard: {
    opacity: 0.72,
  },
  footerAction: {
    marginTop: spacing.xl,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
