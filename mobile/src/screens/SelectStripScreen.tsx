import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabBar } from '../components/BottomTabBar';
import { stripBrands } from '../data/stripBrands';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectStrip'>;

export function SelectStripScreen({ navigation, route }: Props) {
  const recommendedBrand = useMemo(
    () => stripBrands.find((brand) => brand.recommended && brand.supported) ?? stripBrands[0],
    [],
  );
  const [selectedBrandId, setSelectedBrandId] = useState(recommendedBrand.id);
  const selectedBrand = stripBrands.find((b) => b.id === selectedBrandId) ?? recommendedBrand;

  function handleContinue() {
    if (!selectedBrand.supported) return;
    navigation.navigate('ScanPlaceholder', { brandId: selectedBrand.id, poolId: route.params?.poolId });
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Dashboard')}>
            <Text style={styles.iconGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.heading}>בחירת סטיק</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroBadge}><Text style={styles.heroBadgeGlyph}>⌗</Text></View>
          <Text style={styles.heroTitle}>איזה סטיק תרצה לסרוק?</Text>
          <Text style={styles.heroSub}>בחר את מותג הסטיק לפני שמתחילים את הסריקה.</Text>
        </View>

        <View style={styles.list}>
          {stripBrands.map((brand) => {
            const isSelected = selectedBrandId === brand.id;
            const canSelect = brand.supported;
            return (
              <Pressable
                key={brand.id}
                disabled={!canSelect}
                onPress={() => setSelectedBrandId(brand.id)}
                style={({ pressed }) => [
                  styles.brandCard,
                  isSelected && styles.brandCardSelected,
                  !canSelect && styles.brandCardDisabled,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.brandHead}>
                  <View style={styles.badges}>
                    {brand.recommended && <View style={[styles.badge, styles.badgePrimary]}><Text style={styles.badgePrimaryText}>מומלץ</Text></View>}
                    <View style={[styles.badge, brand.supported ? styles.badgeOk : styles.badgeSoon]}>
                      <Text style={brand.supported ? styles.badgeOkText : styles.badgeSoonText}>{brand.supported ? 'נתמך' : 'בקרוב'}</Text>
                    </View>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioActive]}>
                    {isSelected && <View style={styles.radioDot} />}
                  </View>
                </View>
                <Text style={styles.brandName}>{brand.nameHe}</Text>
                <Text style={styles.brandDesc}>{brand.descriptionHe}</Text>
                <View style={styles.swatches}>
                  {brand.swatches.map((s) => (
                    <View key={`${brand.id}-${s}`} style={[styles.swatch, { backgroundColor: s }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.requestCard}>
          <Text style={styles.requestTitle}>הסטיק שלך לא ברשימה?</Text>
          <Text style={styles.requestText}>נוסיף בהמשך טופס בקשה קצר כדי לתעדף תמיכה במותגים נוספים.</Text>
        </View>

        <Pressable onPress={handleContinue} disabled={!selectedBrand.supported} style={({ pressed }) => [styles.primaryBtn, !selectedBrand.supported && { opacity: 0.5 }, pressed && { opacity: 0.9 }]}>
          <Text style={styles.primaryBtnGlyph}>⌗</Text>
          <Text style={styles.primaryBtnLabel}>המשך לסריקה</Text>
        </Pressable>
      </ScrollView>

      <BottomTabBar active="scan" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 140 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  iconGlyph: { fontSize: 24, color: colors.text, fontWeight: '900' },
  heading: { fontSize: 18, fontWeight: '900', color: colors.text, ...rtl.textCenter, flex: 1, fontFamily: typography.fontFamily },
  hero: { backgroundColor: colors.card, borderRadius: 28, padding: 22, alignItems: 'center', ...shadows.card },
  heroBadge: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#E0F7FA', alignItems: 'center', justifyContent: 'center' },
  heroBadgeGlyph: { fontSize: 30, color: colors.primary, fontWeight: '900' },
  heroTitle: { marginTop: 10, fontSize: 20, fontWeight: '900', color: colors.text, ...rtl.textCenter, fontFamily: typography.fontFamily },
  heroSub: { marginTop: 6, fontSize: 13, fontWeight: '600', color: colors.muted, ...rtl.textCenter, lineHeight: 20, fontFamily: typography.fontFamily },
  list: { marginTop: 18, gap: 12 },
  brandCard: { backgroundColor: colors.card, borderRadius: 22, padding: 16, borderWidth: 2, borderColor: 'transparent', gap: 8, ...shadows.card },
  brandCardSelected: { borderColor: colors.primary },
  brandCardDisabled: { opacity: 0.65 },
  brandHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  badges: { flexDirection: 'row-reverse', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePrimary: { backgroundColor: colors.primary }, badgePrimaryText: { color: colors.white, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
  badgeOk: { backgroundColor: '#ECFDF5' }, badgeOkText: { color: '#059669', fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
  badgeSoon: { backgroundColor: '#FFF7ED' }, badgeSoonText: { color: colors.warning, fontSize: 11, fontWeight: '900', fontFamily: typography.fontFamily },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  brandName: { fontSize: 17, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  brandDesc: { fontSize: 13, fontWeight: '600', color: colors.muted, ...rtl.text, lineHeight: 20, fontFamily: typography.fontFamily },
  swatches: { flexDirection: 'row-reverse', gap: 6, marginTop: 4 },
  swatch: { width: 26, height: 26, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  requestCard: { marginTop: 16, backgroundColor: '#F5FAFD', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: colors.border },
  requestTitle: { fontSize: 15, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  requestText: { marginTop: 4, fontSize: 13, fontWeight: '600', color: colors.muted, ...rtl.text, lineHeight: 20, fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 18, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 18, ...shadows.button },
  primaryBtnGlyph: { color: colors.white, fontSize: 20, fontWeight: '900' },
  primaryBtnLabel: { color: colors.white, fontSize: 17, fontWeight: '900', fontFamily: typography.fontFamily },
});
