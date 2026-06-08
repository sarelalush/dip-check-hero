import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { stripBrands } from '../data/stripBrands';
import { colors, rtl, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanPlaceholder'>;

export function ScanPlaceholderScreen({ navigation, route }: Props) {
  const selectedBrand = stripBrands.find((brand) => brand.id === route.params.brandId);

  function handleBackToStrip() {
    if (route.params.poolId) {
      navigation.navigate('SelectStrip', { poolId: route.params.poolId });
      return;
    }

    navigation.navigate('SelectStrip');
  }

  return (
    <Screen>
      <Header />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>סריקה בהמשך</Text>
        <Text style={styles.title}>השלב הבא מוכן לתכנון</Text>
        <Text style={styles.subtitle}>
          עדיין אין מצלמה, ניתוח תמונה או שמירת בדיקות. כרגע שמרנו רק את הבחירה כדי שהזרימה תהיה טבעית.
        </Text>
      </View>

      <View style={styles.section}>
        <Card>
          <Text style={styles.cardLabel}>סטיק נבחר</Text>
          <Text style={styles.cardValue}>{selectedBrand?.nameHe ?? 'לא ידוע'}</Text>
        </Card>

        <Card>
          <Text style={styles.cardLabel}>בריכה</Text>
          <Text style={styles.cardValue}>
            {route.params.poolId ? 'נבחרה בריכה לזרימה הזו' : 'לא נבחרה בריכה כרגע'}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardLabel}>מה יתווסף בהמשך</Text>
          <View style={styles.nextList}>
            <Text style={styles.nextItem}>צילום סטיק הבדיקה</Text>
            <Text style={styles.nextItem}>כיול צבעים ותאורה</Text>
            <Text style={styles.nextItem}>שמירת תוצאות להיסטוריה</Text>
          </View>
        </Card>
      </View>

      <View style={styles.actions}>
        <AppButton label="חזרה לבחירת סטיק" onPress={handleBackToStrip} />
        <AppButton label="חזרה לדשבורד" variant="secondary" onPress={() => navigation.navigate('Dashboard')} />
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
    fontSize: 31,
    fontWeight: '900',
    lineHeight: 39,
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
  nextList: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  nextItem: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
    ...rtl.text,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
});
