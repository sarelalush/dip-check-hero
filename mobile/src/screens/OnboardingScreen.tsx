import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { PoolPhoto } from '../components/WaterVisuals';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export const ONBOARDING_COMPLETE_KEY = '@aquasense/onboarding-complete';

const STEPS: { icon: LineIconName; title: string; text: string }[] = [
  {
    icon: 'pools',
    title: 'הוסף את הבריכה שלך',
    text: 'שומרים שם, נפח וסוג טיפול כדי שכל המלצה תהיה מותאמת.',
  },
  {
    icon: 'scan',
    title: 'צלם סטיק בדיקה',
    text: 'בחר מותג סטיק, צלם תמונה ברורה ואשר לפני הניתוח.',
  },
  {
    icon: 'results',
    title: 'קבל המלצה מדויקת',
    text: 'התוצאה הופכת להמלצת טיפול ברורה ושמורה בהיסטוריה.',
  },
];

async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch (error) {
    console.warn('Failed to save onboarding completion', error);
  }
}

export function OnboardingScreen({ navigation }: Props) {
  async function startFirstPool() {
    await markOnboardingComplete();
    navigation.replace('AddPool');
  }

  async function skipToHome() {
    await markOnboardingComplete();
    navigation.replace('Home');
  }

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <PoolPhoto variant="home" />
      </View>
      <View style={styles.content}>
        <Text style={styles.kicker}>ברוכים הבאים</Text>
        <Text style={styles.title}>AquaSense</Text>
        <Text style={styles.subtitle}>כמה צעדים קצרים ותקבלו המלצות טיפול לבריכה שלכם.</Text>

        <View style={styles.steps}>
          {STEPS.map((step) => (
            <Card compact key={step.title} style={styles.stepCard}>
              <View style={styles.stepIcon}>
                <LineIcon name={step.icon} color={colors.primaryDark} size={18} />
              </View>
              <View style={styles.stepCopy}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.text}</Text>
              </View>
            </Card>
          ))}
        </View>

        <PrimaryButton label="הוסף בריכה ראשונה" icon="plus" onPress={startFirstPool} />
        <Pressable onPress={skipToHome} style={styles.secondary}>
          <Text style={styles.secondaryText}>אעשה את זה אחר כך</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    height: 240,
    overflow: 'hidden',
    backgroundColor: colors.water,
  },
  content: {
    flex: 1,
    marginTop: -46,
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  kicker: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  title: {
    marginTop: 4,
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 31,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  steps: {
    marginTop: 18,
    marginBottom: 16,
    gap: 10,
  },
  stepCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    ...shadows.soft,
  },
  stepIcon: {
    width: 42,
    height: 42,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCopy: {
    flex: 1,
  },
  stepTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  stepText: {
    marginTop: 3,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '800',
    ...rtl.text,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: {
    color: colors.muted,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
  },
});
