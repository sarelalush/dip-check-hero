import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

const features = [
  { value: '3', label: 'סריקות חינם' },
  { value: 'צבע', label: 'קריאה ברורה' },
  { value: 'RTL', label: 'עברית מלאה' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function LandingScreen({ navigation }: Props) {
  return (
    <Screen>
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <Header />

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <Text style={styles.kicker}>AQUASENSE</Text>
        <Text style={styles.title}>
          מים מאוזנים.{'\n'}בלי לנחש.
        </Text>
        <Text style={styles.description}>
          סורקים סרט בדיקה, מקבלים תוצאות מיידיות והנחיות מינון מדויקות לבריכה שלכם.
        </Text>
        <View style={styles.waveLayer}>
          <View style={styles.waveOne} />
          <View style={styles.waveTwo} />
        </View>
      </View>

      <View style={styles.featureRow}>
        {features.map((feature) => (
          <Card key={feature.label} style={styles.featureCard}>
            <Text style={styles.featureValue}>{feature.value}</Text>
            <Text style={styles.featureLabel}>{feature.label}</Text>
          </Card>
        ))}
      </View>

      <View style={styles.actions}>
        <AppButton label="התחילו עכשיו" onPress={() => navigation.navigate('Signup')} />
        <AppButton label="התחברות / הרשמה" variant="secondary" onPress={() => navigation.navigate('Login')} />
      </View>

      <Text style={styles.footer}>תומך ב-AquaChek Pool Test Strips</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backgroundOrbTop: {
    position: 'absolute',
    left: -112,
    top: -118,
    height: 280,
    width: 280,
    borderRadius: 140,
    backgroundColor: colors.primarySoft,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -150,
    right: -112,
    height: 330,
    width: 330,
    borderRadius: 165,
    backgroundColor: '#D4F3FA',
  },
  hero: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 34,
    marginTop: spacing.xxl,
    overflow: 'hidden',
    paddingBottom: 108,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    ...shadows.hero,
  },
  heroGlow: {
    position: 'absolute',
    left: -70,
    top: -88,
    height: 220,
    width: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  kicker: {
    color: '#CFFAFE',
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.textCenter,
  },
  title: {
    color: colors.white,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.display,
    fontWeight: '900',
    lineHeight: typography.lineHeights.display,
    marginTop: spacing.md,
    ...rtl.textCenter,
  },
  description: {
    color: colors.whiteSoft,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '500',
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.md,
    maxWidth: 315,
    ...rtl.textCenter,
  },
  waveLayer: {
    bottom: -30,
    height: 110,
    left: -36,
    position: 'absolute',
    right: -36,
  },
  waveOne: {
    backgroundColor: 'rgba(255,255,255,0.20)',
    borderRadius: radius.round,
    bottom: 10,
    height: 88,
    left: -10,
    position: 'absolute',
    width: 260,
  },
  waveTwo: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.round,
    bottom: 24,
    height: 96,
    position: 'absolute',
    right: -16,
    width: 290,
  },
  featureRow: {
    ...rtl.row,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  featureCard: {
    flex: 1,
    minHeight: 92,
    justifyContent: 'center',
  },
  featureValue: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  featureLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '800',
    marginTop: spacing.xs,
    ...rtl.textCenter,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  footer: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: spacing.lg,
    ...rtl.textCenter,
  },
});
