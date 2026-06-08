import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { stripBrands } from '../data/stripBrands';
import { colors, radius, rtl, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectStrip'>;

export function SelectStripScreen({ navigation, route }: Props) {
  const recommendedBrand = useMemo(
    () => stripBrands.find((brand) => brand.recommended && brand.supported) ?? stripBrands[0],
    [],
  );
  const [selectedBrandId, setSelectedBrandId] = useState(recommendedBrand.id);
  const selectedBrand = stripBrands.find((brand) => brand.id === selectedBrandId) ?? recommendedBrand;

  function handleContinue() {
    if (!selectedBrand.supported) {
      return;
    }

    navigation.navigate('ScanPlaceholder', {
      brandId: selectedBrand.id,
      poolId: route.params?.poolId,
    });
  }

  return (
    <Screen>
      <Header />
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>בחירת סטיק בדיקה</Text>
        <Text style={styles.title}>איזה סטיק תרצה לסרוק?</Text>
        <Text style={styles.subtitle}>
          בשלב הזה נבחר את סוג הסטיק בלבד. הסריקה והניתוח יתווספו בסלייס הבא, בלי מצלמה או AI כרגע.
        </Text>
      </View>

      <View style={styles.section}>
        {stripBrands.map((brand) => {
          const isSelected = selectedBrandId === brand.id;
          const canSelect = brand.supported;

          return (
            <Pressable
              key={brand.id}
              disabled={!canSelect}
              onPress={() => setSelectedBrandId(brand.id)}
              style={({ pressed }: { pressed: boolean }) => [
                styles.pressable,
                pressed && styles.pressed,
                !canSelect && styles.disabledPressable,
              ]}
            >
              <Card style={[styles.brandCard, isSelected && styles.selectedCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.badges}>
                    {brand.recommended ? (
                      <Text style={[styles.badge, styles.recommendedBadge]}>מומלץ</Text>
                    ) : null}
                    <Text style={[styles.badge, brand.supported ? styles.supportedBadge : styles.futureBadge]}>
                      {brand.supported ? 'נתמך' : 'בקרוב'}
                    </Text>
                  </View>
                  <Text style={styles.brandName}>{brand.nameHe}</Text>
                </View>

                <Text style={styles.description}>{brand.descriptionHe}</Text>

                <View style={styles.swatches}>
                  {brand.swatches.map((swatch) => (
                    <View key={`${brand.id}-${swatch}`} style={[styles.swatch, { backgroundColor: swatch }]} />
                  ))}
                </View>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Card style={styles.requestCard}>
        <Text style={styles.requestTitle}>הסטיק שלך לא ברשימה?</Text>
        <Text style={styles.requestText}>
          נוסיף בהמשך טופס בקשה קצר כדי לתעדף תמיכה במותגים נוספים.
        </Text>
      </Card>

      <View style={styles.actions}>
        <AppButton label="המשך למסך סריקה עתידי" onPress={handleContinue} />
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
  pressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  disabledPressable: {
    opacity: 0.76,
  },
  brandCard: {
    gap: spacing.md,
  },
  selectedCard: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  cardHeader: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  badges: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  badge: {
    borderRadius: radius.round,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    ...rtl.textCenter,
  },
  recommendedBadge: {
    backgroundColor: colors.primary,
    color: colors.white,
  },
  supportedBadge: {
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
  },
  futureBadge: {
    backgroundColor: '#FFF7ED',
    color: colors.warning,
  },
  brandName: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 20,
    fontWeight: '900',
    lineHeight: 28,
    ...rtl.text,
  },
  description: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    ...rtl.text,
  },
  swatches: {
    flexDirection: 'row-reverse',
    gap: spacing.xs,
  },
  swatch: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 28,
    width: 28,
  },
  requestCard: {
    backgroundColor: colors.subtle,
    marginTop: spacing.lg,
  },
  requestTitle: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 18,
    fontWeight: '900',
    ...rtl.text,
  },
  requestText: {
    color: colors.muted,
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
