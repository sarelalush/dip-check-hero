import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { WaterTexture } from '../components/WaterVisuals';
import { stripBrands } from '../data/stripBrands';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanPlaceholder'>;

const TIPS = [
  { icon: 'scan', text: 'הנח את הסטיק על רקע בהיר ונקי' },
  { icon: 'flash', text: 'צלם באור טוב, בלי צל חזק או השתקפות' },
  { icon: 'check', text: 'ודא שכל ריבועי הצבע גלויים ולא חתוכים' },
] as const;

export function ScanPlaceholderScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const selectedBrand = stripBrands.find((brand) => brand.id === route.params.brandId);

  function handleClose() {
    if (route.params.poolId) {
      navigation.navigate('SelectStrip', { poolId: route.params.poolId });
      return;
    }

    navigation.navigate('Home');
  }

  function startCamera() {
    navigation.navigate('Scan', {
      brandId: route.params.brandId,
      poolId: route.params.poolId,
    });
  }

  return (
    <View style={styles.root}>
      <WaterTexture deep />

      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={handleClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <LineIcon name="close" color={colors.white} size={24} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text style={styles.brand}>AquaSense</Text>
        <Text style={styles.title}>לפני שמצלמים</Text>
        <Text style={styles.subtitle}>
          צילום נקי של הסטיק עוזר לקבל תוצאה מדויקת יותר. במסך הבא מקם את הסטיק בתוך המסגרת הצרה.
        </Text>

        <View style={styles.previewCard}>
          <View style={styles.framePreview}>
            <MockStrip />
          </View>

          <View style={styles.examplesRow}>
            <View style={styles.exampleBox}>
              <View style={styles.badBackground}>
                <MockStrip small />
              </View>
              <View style={[styles.badge, styles.badBadge]}>
                <LineIcon name="close" color={colors.white} size={14} />
              </View>
              <Text style={styles.exampleText}>רחוק מדי</Text>
            </View>

            <View style={styles.exampleBox}>
              <MockStrip small />
              <View style={[styles.badge, styles.goodBadge]}>
                <LineIcon name="check" color={colors.white} size={14} />
              </View>
              <Text style={styles.exampleText}>צמוד וברור</Text>
            </View>
          </View>
        </View>

        <View style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>כך נקבל צילום טוב</Text>
          {TIPS.map((tip) => (
            <View key={tip.text} style={styles.tipRow}>
              <View style={styles.tipIcon}>
                <LineIcon name={tip.icon} color={colors.primaryDark} size={18} />
              </View>
              <Text style={styles.tipText}>{tip.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.brandName}>{selectedBrand?.nameHe ?? 'סטיק בדיקה'}</Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom + 16, 28) }]}>
        <PrimaryButton label="המשך לצילום" icon="camera" onPress={startCamera} />
      </View>
    </View>
  );
}

function MockStrip({ small = false }: { small?: boolean }) {
  const pads = ['#F2F4EF', '#7ECFD0', '#A4CFA2', '#F2C64B', '#F39C38', '#E7767D', '#A56BC0'];

  return (
    <View style={[styles.strip, small && styles.stripSmall]}>
      {pads.map((pad) => (
        <View key={pad} style={[styles.pad, small && styles.padSmall, { backgroundColor: pad }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  topBar: {
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  closeButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(6,30,42,0.35)',
    borderColor: 'rgba(255,255,255,0.32)',
    borderRadius: 24,
    borderWidth: 1,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: 72,
  },
  brand: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 33,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  title: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 35,
    fontWeight: '900',
    marginTop: spacing.md,
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 24,
    marginTop: spacing.sm,
    ...rtl.textCenter,
  },
  previewCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
    ...shadows.card,
  },
  framePreview: {
    alignItems: 'center',
    borderColor: colors.primaryLight,
    borderRadius: 18,
    borderWidth: 3,
    height: 210,
    justifyContent: 'center',
    width: 58,
  },
  examplesRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.md,
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  exampleBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 112,
    padding: spacing.sm,
  },
  badBackground: {
    alignItems: 'center',
    backgroundColor: colors.water,
    borderRadius: 10,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    position: 'absolute',
    top: 4,
    width: 28,
  },
  badBadge: {
    backgroundColor: colors.danger,
    right: 18,
  },
  goodBadge: {
    backgroundColor: colors.success,
    right: 24,
  },
  exampleText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 6,
    ...rtl.textCenter,
  },
  tipsCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  tipsTitle: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: spacing.sm,
    ...rtl.textCenter,
  },
  tipRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  tipIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  tipText: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '800',
    ...rtl.text,
  },
  brandName: {
    color: colors.muted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '800',
    marginTop: spacing.sm,
    ...rtl.textCenter,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
  strip: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 7,
    height: 188,
    justifyContent: 'space-evenly',
    paddingVertical: 7,
    width: 28,
    ...shadows.card,
  },
  stripSmall: {
    borderRadius: 5,
    height: 74,
    paddingVertical: 4,
    width: 15,
  },
  pad: {
    borderRadius: 3,
    height: 21,
    width: 21,
  },
  padSmall: {
    borderRadius: 2,
    height: 8,
    width: 8,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
});
