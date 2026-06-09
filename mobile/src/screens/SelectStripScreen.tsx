import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { StatusBadge } from '../components/StatusBadge';
import { getRecommendedBrand, stripBrands } from '../config/stripBrands';
import { getBrandSwatches } from '../config/brandSwatches';
import { PARAM_LABEL_HE, type StripBrand } from '../domain/strip';
import { usePools } from '../state/PoolsContext';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectStrip'>;

export function SelectStripScreen({ navigation, route }: Props) {
  const { getPool } = usePools();
  const initialBrand = useMemo(
    () => getRecommendedBrand(),
    [],
  );
  const [selectedBrandId, setSelectedBrandId] = useState(initialBrand.id);
  const selectedBrand = stripBrands.find((brand) => brand.id === selectedBrandId) ?? initialBrand;
  const pool = route.params?.poolId ? getPool(route.params.poolId) : undefined;

  function handleContinue() {
    if (!selectedBrand.supported) return;
    navigation.navigate('Scan', { brandId: selectedBrand.id, poolId: route.params?.poolId });
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <LineIcon name="scan" color={colors.primaryDark} size={24} />
        </View>
        <Text style={styles.title}>בחירת סטיק</Text>
        <Text style={styles.subtitle}>
          {pool ? `${pool.name} · בחר מותג לפני הסריקה` : 'בחר מותג סטיק לפני שמתחילים סריקה'}
        </Text>
      </View>

      <View style={styles.list}>
        {stripBrands.map((brand) => (
          <StripCard
            key={brand.id}
            brand={brand}
            selected={selectedBrand.id === brand.id}
            onPress={() => setSelectedBrandId(brand.id)}
          />
        ))}
      </View>

      <Card compact style={styles.noteCard}>
        <View style={styles.noteIcon}>
          <LineIcon name="help" color={colors.primaryDark} size={16} />
        </View>
        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>הסטיק שלך לא ברשימה?</Text>
          <Text style={styles.noteText}>כרגע הסריקה תומכת במותגים מסומנים בלבד. מותגים נוספים ייפתחו בהמשך.</Text>
        </View>
      </Card>

      <View style={styles.cta}>
        <PrimaryButton
          disabled={!selectedBrand.supported}
          label={selectedBrand.supported ? 'המשך לסריקה' : 'מותג זה ייתמך בקרוב'}
          icon="scan"
          onPress={handleContinue}
        />
      </View>
    </AppShell>
  );
}

function StripCard({
  brand,
  onPress,
  selected,
}: {
  brand: StripBrand;
  onPress: () => void;
  selected: boolean;
}) {
  const canContinue = brand.supported;
  const swatchGroups = getBrandSwatches(brand);
  const visibleSwatchGroups = swatchGroups.slice(0, 3);
  const hiddenSwatchGroupCount = Math.max(0, swatchGroups.length - visibleSwatchGroups.length);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.stripCard,
        selected && styles.stripCardSelected,
        !canContinue && styles.stripCardSoon,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.cardTop}>
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected ? <LineIcon name="check" color={colors.white} size={14} /> : null}
        </View>
        <View style={styles.brandTitleWrap}>
          <Text style={styles.brandName}>{brand.nameHe}</Text>
          <View style={styles.badges}>
            {brand.recommended ? <StatusBadge label="מומלץ" tone="neutral" /> : null}
            <StatusBadge label={brand.supported ? 'נתמך' : 'בקרוב'} tone={brand.supported ? 'success' : 'warning'} />
          </View>
        </View>
      </View>

      <Text style={styles.brandDescription}>{brand.descriptionHe}</Text>

      <View style={styles.parameters}>
        {brand.parameters.map((parameter) => (
          <View key={`${brand.id}-${parameter}`} style={styles.parameterPill}>
            <Text style={styles.parameterPillText}>{PARAM_LABEL_HE[parameter].labelHe}</Text>
          </View>
        ))}
      </View>

      <View style={styles.swatchRows}>
        {visibleSwatchGroups.map((group) => (
          <View key={`${brand.id}-${group.paramKey}`} style={styles.swatchRow}>
            <Text style={styles.swatchLabel}>{group.labelHe}</Text>
            <View style={styles.swatches}>
              {group.swatches.slice(0, 6).map((swatch) => (
                <View key={`${brand.id}-${group.paramKey}-${swatch.label}`} style={[styles.swatch, { backgroundColor: swatch.color }]} />
              ))}
            </View>
          </View>
        ))}
        {hiddenSwatchGroupCount > 0 ? (
          <Text style={styles.moreSwatches}>+{hiddenSwatchGroupCount} מדדים נוספים</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 18,
    alignItems: 'center',
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '700',
    ...rtl.textCenter,
  },
  list: {
    marginTop: 18,
    gap: 12,
  },
  stripCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 14,
    gap: 10,
    ...shadows.soft,
  },
  stripCardSelected: {
    borderColor: colors.primary,
    shadowOpacity: 0.1,
  },
  stripCardSoon: {
    opacity: 0.72,
  },
  cardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  radio: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  brandTitleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  brandName: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    fontWeight: '900',
    ...rtl.text,
  },
  badges: {
    marginTop: 7,
    flexDirection: 'row-reverse',
    gap: 6,
  },
  brandDescription: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    ...rtl.text,
  },
  parameters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  parameterPill: {
    borderRadius: 999,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  parameterPillText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  swatchRows: {
    gap: 7,
  },
  swatchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  swatchLabel: {
    minWidth: 72,
    color: colors.muted,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '900',
    ...rtl.text,
  },
  swatches: {
    flexDirection: 'row-reverse',
    flex: 1,
    gap: 4,
  },
  swatch: {
    flex: 1,
    maxWidth: 28,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreSwatches: {
    color: colors.muted,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  noteCard: {
    marginTop: 14,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.surfaceSoft,
  },
  noteIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteCopy: {
    flex: 1,
  },
  noteTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  noteText: {
    marginTop: 3,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
    ...rtl.text,
  },
  cta: {
    marginTop: 16,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
