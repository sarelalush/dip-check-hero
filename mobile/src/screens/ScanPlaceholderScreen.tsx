import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { stripBrands } from '../data/stripBrands';
import { colors, radius, rtl, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanPlaceholder'>;

export function ScanPlaceholderScreen({ navigation, route }: Props) {
  const selectedBrand = stripBrands.find((b) => b.id === route.params.brandId);

  function handleClose() {
    if (route.params.poolId) {
      navigation.navigate('SelectStrip', { poolId: route.params.poolId });
      return;
    }
    navigation.navigate('Dashboard');
  }

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable onPress={handleClose} style={styles.closeBtn}>
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <Text style={styles.title}>סריקת סטיק</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.frameWrap}>
        <View style={styles.frame}>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <Text style={styles.frameHint}>מקם את הסטיק במרכז המסגרת</Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Text style={styles.brand}>{selectedBrand?.nameHe ?? 'סטיק בדיקה'}</Text>
        <Text style={styles.hint}>החזק את המצלמה יציבה ובאור טבעי לתוצאות מדויקות</Text>
        <Pressable style={styles.shutter} onPress={handleClose}>
          <View style={styles.shutterInner} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0E3A4C' },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeGlyph: { color: colors.white, fontSize: 18, fontWeight: '900' },
  title: { color: colors.white, fontSize: 18, fontWeight: '900', ...rtl.textCenter },
  frameWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  frame: {
    width: '100%',
    aspectRatio: 1,
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 36, height: 36,
    borderColor: '#0FB5C9',
  },
  cTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 24 },
  cTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 24 },
  cBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 24 },
  cBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 24 },
  frameHint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14, fontWeight: '700',
    ...rtl.textCenter,
    paddingHorizontal: spacing.md,
  },
  bottom: { paddingHorizontal: spacing.lg, paddingBottom: 40, alignItems: 'center' },
  brand: { color: colors.white, fontSize: 16, fontWeight: '900', marginBottom: 6, ...rtl.textCenter },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600', marginBottom: spacing.lg, ...rtl.textCenter },
  shutter: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: '#0FB5C9',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0FB5C9', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  shutterInner: {
    width: 60, height: 60, borderRadius: 30,
    borderWidth: 4, borderColor: colors.white,
    backgroundColor: '#0FB5C9',
  },
});
