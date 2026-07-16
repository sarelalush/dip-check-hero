import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmScan'>;

const checklistItems = ['הסטיק חתוך ללא רקע', 'כל ריבועי הצבע נראים', 'התמונה חדה ומוכנה לניתוח'];

export function ConfirmScanScreen({ navigation, route }: Props) {
  const { confirmImage, session, setCurrentStep, setImageUri, setScanError } = useScanSession();
  const brandId = session.selectedBrandId ?? route.params.brandId;
  const imageUri = session.imageUri ?? route.params.imageUri;
  const poolId = session.selectedPoolId ?? route.params.poolId;

  useEffect(() => {
    if (!session.imageUri && route.params.imageUri) {
      setImageUri(route.params.imageUri);
    }
  }, [route.params.imageUri, session.imageUri, setImageUri]);

  useEffect(() => {
    if (imageUri) return;

    setScanError({
      code: 'missingImage',
      message: 'בחר תמונת סטיק לפני אישור הסריקה.',
    });
    navigation.replace('Scan', { brandId, poolId });
  }, [brandId, imageUri, navigation, poolId, setScanError]);

  useEffect(() => {
    if (!imageUri) return;
    setCurrentStep('confirm');
  }, [imageUri, setCurrentStep]);

  function continueToResults() {
    confirmImage();
    navigation.navigate('Results', {
      brandId,
      imageUri,
      poolId,
    });
  }

  function retakeImage() {
    setImageUri(undefined);
    navigation.replace('Scan', { brandId, poolId });
  }

  if (!imageUri) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
        <View style={styles.header}>
          <Text style={styles.title}>תצוגה מקדימה</Text>
          <Text style={styles.subtitle}>מחזירים אותך למסך הצילום.</Text>
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>תצוגה מקדימה</Text>
        <Text style={styles.subtitle}>זו התמונה החתוכה שתישלח לניתוח. ודא שרואים רק את הסטיק.</Text>
      </View>

      <Card style={styles.previewCard}>
        <View style={styles.previewFrame}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        </View>
        <View style={styles.previewPill}>
          <LineIcon name="check" color={colors.success} size={14} />
          <Text style={styles.previewPillText}>רק הסטיק יישלח ל-AI</Text>
        </View>
      </Card>

      <Card compact style={styles.checklistCard}>
        {checklistItems.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkIcon}>
              <LineIcon name="check" color={colors.success} size={14} />
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <PrimaryButton label="השתמש בתמונה" icon="results" onPress={continueToResults} />
        <Pressable onPress={retakeImage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <LineIcon name="camera" color={colors.primaryDark} size={17} />
          <Text style={styles.secondaryButtonText}>צלם שוב</Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginTop: 18,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 7,
    ...rtl.textCenter,
  },
  previewCard: {
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: spacing.md,
  },
  previewFrame: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.backgroundDeep,
    borderColor: colors.borderStrong,
    borderRadius: radius.xl,
    borderWidth: 1,
    height: 430,
    justifyContent: 'center',
    maxHeight: 460,
    maxWidth: 158,
    overflow: 'hidden',
    width: '42%',
    ...shadows.soft,
  },
  previewImage: {
    height: '100%',
    width: '100%',
  },
  previewPill: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.round,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  previewPillText: {
    color: colors.success,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  checklistCard: {
    gap: 10,
    marginTop: 12,
  },
  checkRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    minHeight: 34,
  },
  checkIcon: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  checkText: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  actions: {
    gap: 11,
    marginTop: 16,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.borderSoft,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
    ...shadows.soft,
  },
  secondaryButtonText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
