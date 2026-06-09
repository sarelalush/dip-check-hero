import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { LineIcon } from '../components/LineIcon';
import { WaterTexture } from '../components/WaterVisuals';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Scan'>;
type PickSource = 'camera' | 'library';

const pickerOptions: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  allowsEditing: false,
  base64: true,
  quality: 0.9,
};

export function ScanScreen({ navigation, route }: Props) {
  const { resetScanSession, session, setCurrentStep, setImageUri, setScanError, startScanSession } = useScanSession();
  const didInitializeSession = useRef(false);
  const [selectedImageUri, setSelectedImageUri] = useState<string | undefined>(session.imageUri);
  const [feedback, setFeedback] = useState('בחרו תמונת סטיק או צלמו אחת חדשה');
  const [isPicking, setIsPicking] = useState(false);
  const activeBrandId = session.selectedBrandId ?? route.params?.brandId;

  const resultParams = useMemo(
    () => ({
      brandId: session.selectedBrandId ?? route.params?.brandId,
      poolId: session.selectedPoolId ?? route.params?.poolId,
    }),
    [route.params?.brandId, route.params?.poolId, session.selectedBrandId, session.selectedPoolId]
  );

  useEffect(() => {
    if (didInitializeSession.current) return;
    didInitializeSession.current = true;

    if (route.params?.brandId || route.params?.poolId) {
      startScanSession({
        brandId: route.params?.brandId ?? session.selectedBrandId,
        poolId: route.params?.poolId ?? session.selectedPoolId,
      });
    }
  }, [
    route.params?.brandId,
    route.params?.poolId,
    session.selectedBrandId,
    session.selectedPoolId,
    startScanSession,
  ]);

  useEffect(() => {
    if (activeBrandId) return;

    setScanError({
      code: 'missingBrand',
      message: 'בחרו מותג סטיק לפני שמתחילים סריקה.',
    });
    navigation.replace('SelectStrip', route.params?.poolId ? { poolId: route.params.poolId } : undefined);
  }, [activeBrandId, navigation, route.params?.poolId, setScanError]);

  useEffect(() => {
    if (!activeBrandId) return;
    setCurrentStep('scan');
  }, [activeBrandId, setCurrentStep]);

  async function pickImage(source: PickSource) {
    if (isPicking) {
      return;
    }

    setIsPicking(true);
    setFeedback(source === 'camera' ? 'פותח מצלמה...' : 'פותח גלריה...');

    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setScanError({
          code: 'permissionDenied',
          message:
            source === 'camera'
              ? 'כדי לצלם סטיק צריך לאשר גישה למצלמה.'
              : 'כדי לבחור תמונה צריך לאשר גישה לגלריה.',
        });
        setFeedback(
          source === 'camera'
            ? 'כדי לצלם סטיק צריך לאשר גישה למצלמה'
            : 'כדי לבחור תמונה צריך לאשר גישה לגלריה'
        );
        return;
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled) {
        setFeedback('לא נבחרה תמונה. אפשר לנסות שוב.');
        return;
      }

      const asset = result.assets[0];
      const uri = asset?.base64 ? `data:${asset.mimeType ?? 'image/jpeg'};base64,${asset.base64}` : asset?.uri;
      if (!uri) {
        setFeedback('לא הצלחנו לקרוא את התמונה. נסו תמונה אחרת.');
        return;
      }

      setSelectedImageUri(uri);
      setImageUri(uri);
      setFeedback('התמונה התקבלה. אפשר להמשיך לתוצאות.');
    } catch {
      setScanError({
        code: 'imagePickerFailed',
        message: 'משהו השתבש בטעינת התמונה. נסו שוב.',
      });
      setFeedback('משהו השתבש בטעינת התמונה. נסו שוב.');
    } finally {
      setIsPicking(false);
    }
  }

  function continueToResults() {
    const imageUri = selectedImageUri ?? session.imageUri;

    if (!imageUri) {
      setFeedback('בחרו תמונה או צלמו סטיק לפני שממשיכים.');
      return;
    }

    navigation.navigate('ConfirmScan', {
      ...resultParams,
      imageUri,
    });
  }

  function closeScan() {
    resetScanSession();
    navigation.navigate('Home');
  }

  return (
    <AppShell activeTab="scan" navigation={navigation} scroll={false} waterMode="full">
      <View style={styles.screen}>
        <View style={styles.waterLayer}>
          <WaterTexture deep />
        </View>
        <View style={styles.topBar}>
          <View style={styles.actions}>
            <Pressable style={styles.toolButton}>
              <LineIcon name="help" color={colors.white} size={20} />
            </Pressable>
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>סריקת סטיק</Text>
            <Text style={styles.subtitle}>בחרו תמונה ברורה של הסטיק בתוך המסגרת</Text>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.toolButton} onPress={() => pickImage('camera')}>
              <LineIcon name="flash" color={colors.white} size={20} />
            </Pressable>
          </View>
        </View>

        <View style={styles.scanArea}>
          <Pressable onPress={() => pickImage('library')} style={styles.frame}>
            {selectedImageUri ? (
              <>
                <Image source={{ uri: selectedImageUri }} style={styles.previewImage} resizeMode="cover" />
                <View style={styles.previewBadge}>
                  <LineIcon name="check" color={colors.white} size={13} />
                  <Text style={styles.previewBadgeText}>תמונה מוכנה</Text>
                </View>
              </>
            ) : (
              <>
                <MockStrip />
                <View style={styles.hand}>
                  <View style={styles.thumb} />
                  <View style={styles.finger} />
                </View>
              </>
            )}
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
          </Pressable>
        </View>

        <View style={styles.bottomArea}>
          <View style={styles.instructionPill}>
            <Text style={styles.instruction}>{feedback}</Text>
          </View>

          <View style={styles.pickActions}>
            <Pressable
              onPress={() => pickImage('library')}
              style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
            >
              <LineIcon name="image" color={colors.primaryDark} size={16} />
              <Text style={styles.pickButtonText}>{selectedImageUri ? 'החלפת תמונה' : 'בחירה מהגלריה'}</Text>
            </Pressable>
            <Pressable
              onPress={() => pickImage('camera')}
              style={({ pressed }) => [styles.pickButton, pressed && styles.pressed]}
            >
              <LineIcon name="camera" color={colors.primaryDark} size={16} />
              <Text style={styles.pickButtonText}>צילום סטיק</Text>
            </Pressable>
          </View>

          <Pressable onPress={continueToResults} style={({ pressed }) => [styles.resultsButton, pressed && styles.pressed]}>
            <LineIcon name="results" color={colors.white} size={16} />
            <Text style={styles.resultsButtonText}>המשך לתוצאות</Text>
          </Pressable>
          <Pressable onPress={closeScan} style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}>
            <LineIcon name="close" color={colors.text} size={24} />
          </Pressable>
        </View>
      </View>
    </AppShell>
  );
}

function MockStrip() {
  const pads = ['#F3C45C', '#D8728F', '#72C9BD', '#6B8BD8', '#BFD85E'];

  return (
    <View style={styles.strip}>
      {pads.map((pad) => (
        <View key={pad} style={[styles.pad, { backgroundColor: pad }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingTop: 8,
    paddingBottom: 120,
  },
  waterLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 5,
    color: 'rgba(255,255,255,0.86)',
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  toolButton: {
    width: 34,
    height: 34,
    borderRadius: 18,
    backgroundColor: 'rgba(0,48,65,0.14)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.soft,
  },
  scanArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  frame: {
    width: '82%',
    maxWidth: 300,
    aspectRatio: 1,
    borderRadius: radius.xxl,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.42)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '88%',
    height: '88%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.62)',
  },
  previewBadge: {
    position: 'absolute',
    bottom: 18,
    alignSelf: 'center',
    minHeight: 30,
    borderRadius: radius.round,
    backgroundColor: 'rgba(4,44,57,0.68)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
  },
  previewBadgeText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  corner: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderColor: colors.white,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius.xl,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius.xl,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.xl,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.xl,
  },
  strip: {
    width: 38,
    height: 240,
    borderRadius: 10,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 10,
    ...shadows.card,
  },
  pad: {
    width: 26,
    height: 25,
    borderRadius: 4,
  },
  hand: {
    position: 'absolute',
    bottom: -84,
    left: 95,
    width: 92,
    height: 118,
    borderTopLeftRadius: 42,
    borderTopRightRadius: 42,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    backgroundColor: '#F1C4A8',
    transform: [{ rotate: '-9deg' }],
  },
  thumb: {
    position: 'absolute',
    top: 18,
    right: -18,
    width: 36,
    height: 58,
    borderRadius: 20,
    backgroundColor: '#E8B08F',
    transform: [{ rotate: '-24deg' }],
  },
  finger: {
    position: 'absolute',
    top: -36,
    left: 34,
    width: 31,
    height: 82,
    borderRadius: 18,
    backgroundColor: '#F8D0B7',
  },
  bottomArea: {
    alignItems: 'center',
    gap: spacing.md,
  },
  instructionPill: {
    borderRadius: radius.round,
    backgroundColor: 'rgba(4,44,57,0.62)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...shadows.soft,
  },
  instruction: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pickActions: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 10,
  },
  pickButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.whiteSoft,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    ...shadows.soft,
  },
  pickButtonText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  resultsButton: {
    minHeight: 42,
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    ...shadows.button,
  },
  resultsButtonText: {
    color: colors.white,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
