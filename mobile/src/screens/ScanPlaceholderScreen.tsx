import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ScanPlaceholder'>;

const POOL_BACKGROUND = require('../../assets/images/home-pool.png');

export function ScanPlaceholderScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { setScanError, startScanSession } = useScanSession();
  const [galleryBusy, setGalleryBusy] = useState(false);

  useEffect(() => {
    startScanSession({
      brandId: route.params.brandId,
      poolId: route.params.poolId,
    });
  }, [route.params.brandId, route.params.poolId, startScanSession]);

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

  async function pickFromGallery() {
    if (galleryBusy) return;

    try {
      setGalleryBusy(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setScanError({
          code: 'permissionDenied',
          message: 'צריך לאפשר גישה לתמונות כדי לבחור תמונת סטיק מהגלריה.',
        });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        mediaTypes: ['images'],
        quality: 1,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      const asset = result.assets[0];
      navigation.navigate('CropScanImage', {
        brandId: route.params.brandId,
        imageHeight: asset.height,
        imageUri: asset.uri,
        imageWidth: asset.width,
        poolId: route.params.poolId,
      });
    } catch (error) {
      console.warn('Failed to pick scan image from gallery', error);
      setScanError({
        code: 'imagePickerFailed',
        message: 'לא הצלחנו לבחור תמונה מהגלריה. נסה שוב או צלם דרך המצלמה.',
      });
    } finally {
      setGalleryBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ImageBackground source={POOL_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View style={styles.backdrop} />
      </ImageBackground>

      <View style={[styles.topBar, { paddingTop: insets.top + 14 }]}>
        <Pressable onPress={handleClose} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
          <LineIcon name="close" color={colors.white} size={24} />
        </Pressable>
      </View>

      <View style={[styles.content, { paddingTop: insets.top + 72, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.brand}>AquaSense</Text>

        <View style={styles.card}>
          <Text style={styles.title}>רגע לפני הצילום</Text>
          <Text style={styles.subtitle}>
            במסך הבא מקם את סטיק הבדיקה בתוך המסגרת הצרה. ודא שכל ריבועי הצבע נמצאים בתוך הקווים ורואים אותם בבירור.
          </Text>

          <View style={styles.framePreview}>
            <MockStrip />
          </View>

          <Text style={styles.note}>המסגרת צריכה להיות צמודה לסטיק, בלי רקע מיותר מסביב.</Text>

          <View style={styles.actions}>
            <PrimaryButton label="פתח מצלמה" icon="camera" onPress={startCamera} />
            <Pressable
              disabled={galleryBusy}
              onPress={pickFromGallery}
              style={({ pressed }) => [styles.galleryButton, galleryBusy && styles.disabled, pressed && !galleryBusy && styles.pressed]}
            >
              <LineIcon name="image" color={colors.primaryDark} size={18} />
              <Text style={styles.galleryButtonText}>{galleryBusy ? 'פותחים גלריה...' : 'בחר תמונה מהגלריה'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

function MockStrip() {
  const pads = ['#F2F4EF', '#7ECFD0', '#A4CFA2', '#F2C64B', '#F39C38', '#E7767D', '#A56BC0'];

  return (
    <View style={styles.strip}>
      {pads.map((pad) => (
        <View key={pad} style={[styles.pad, { backgroundColor: pad }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(238,252,255,0.55)',
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
    borderColor: 'rgba(255,255,255,0.38)',
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
  },
  brand: {
    color: colors.primary,
    fontFamily: typography.fontFamilyBold,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: spacing.md,
    textShadowColor: 'rgba(255,255,255,0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    ...rtl.textCenter,
  },
  card: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.card,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 25,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 23,
    marginTop: spacing.sm,
    ...rtl.textCenter,
  },
  framePreview: {
    alignItems: 'center',
    borderColor: colors.primaryLight,
    borderRadius: 18,
    borderWidth: 3,
    height: 208,
    justifyContent: 'center',
    marginTop: spacing.md,
    width: 72,
  },
  note: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    marginTop: spacing.sm,
    ...rtl.textCenter,
  },
  actions: {
    alignSelf: 'stretch',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  galleryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.borderStrong,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.md,
    ...shadows.soft,
  },
  galleryButtonText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  strip: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 7,
    height: 178,
    justifyContent: 'space-evenly',
    paddingVertical: 7,
    width: 28,
    ...shadows.card,
  },
  pad: {
    borderRadius: 3,
    height: 20,
    width: 20,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
