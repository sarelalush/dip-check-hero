import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';
import { inspectCaptureImage } from '../services/captureImageQuality';
import type { ImageQualityReport } from '../domain/captureQuality';
import { DisclosureSection } from '../components/DisclosureSection';
import { AiConsentPanel } from '../components/AiConsentPanel';
import { useLegalConsent } from '../state/LegalConsentContext';
import { requireCurrentAiConsent } from '../services/legalConsentService';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmScan'>;

export function ConfirmScanScreen({ navigation, route }: Props) {
  const {
    confirmImage,
    ensureTestId,
    session,
    setCurrentStep,
    setImageUri,
    setScanError,
    setImageQuality,
    setQualityNotes,
  } = useScanSession();
  const [report, setReport] = useState<ImageQualityReport>();
  const [checking, setChecking] = useState(true);
  const [enlarged, setEnlarged] = useState(false);
  const { status: consent } = useLegalConsent();
  const [consentError, setConsentError] = useState('');
  const [sending, setSending] = useState(false);
  const brandId = session.selectedBrandId ?? route.params.brandId;
  const imageUri = session.imageUri ?? route.params.imageUri;
  const poolId = session.selectedPoolId ?? route.params.poolId;

  useEffect(() => {
    let active = true;
    setChecking(true);
    setReport(undefined);
    if (imageUri)
      void inspectCaptureImage(imageUri).then((quality) => {
        if (!active) return;
        setReport(quality);
        setImageQuality(quality);
        setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [imageUri, setImageQuality]);

  useEffect(() => {
    if (!session.imageUri && route.params.imageUri) {
      setImageUri(route.params.imageUri, { preserveTestId: true });
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

  async function continueToResults() {
    if (sending || checking || !report || report.status === 'blocked' || !consent?.aiAllowed) return;
    setSending(true); setConsentError('');
    try { await requireCurrentAiConsent(); }
    catch (error) {
      setConsentError(error instanceof Error ? error.message : 'לא ניתן לאמת הסכמה.');
      setSending(false); return;
    }
    const scanTestId = session.testId ?? ensureTestId();
    setQualityNotes(
      [
        `Local image check: ${report.status}; this is not a calibrated strip detector.`,
        ...report.warnings,
      ],
      report.status === 'checked' && !report.warnings.length ? 'passed' : 'needsReview',
    );
    confirmImage();
    navigation.navigate('Results', {
      brandId,
      imageUri,
      poolId,
      scanTestId,
    });
    setSending(false);
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
        <Text style={styles.subtitle}>
          בדוק את כל ריבועי הצבע לפני השליחה. גע בתמונה כדי להגדיל.
        </Text>
      </View>

      <Card style={styles.previewCard}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="הגדל תמונת סטיק לבדיקה"
          onPress={() => setEnlarged(true)}
          style={[
            styles.previewFrame,
            report && report.width > report.height && { width: '100%', maxWidth: 340, height: 110 },
          ]}
        >
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="contain" />
        </Pressable>
        <View style={styles.previewPill}>
          <LineIcon name="image" color={colors.primaryDark} size={14} />
          <Text style={styles.previewPillText}>התמונה הזו תישלח לניתוח</Text>
        </View>
      </Card>

      <Card compact style={styles.qualityCard}>
        <Text style={styles.qualityTitle}>
          {checking
            ? 'בודקים את איכות התמונה...'
            : report?.status === 'blocked'
              ? 'נדרש צילום חדש'
              : report?.warnings.length
                ? 'כדאי לבדוק לפני השליחה'
                : 'בדיקת האיכות הסתיימה'}
        </Text>
        {checking ? <ActivityIndicator color={colors.primary} /> : null}
        {[...(report?.blockers ?? []), ...(report?.warnings ?? [])].map((message) => (
          <Text key={message} style={styles.qualityText}>
            {message}
          </Text>
        ))}
        {session.captureMetadata?.source === 'gallery' ? (
          <Text style={styles.qualityText}>תמונה מהגלריה · זמן הקריאה אינו ידוע</Text>
        ) : null}
      </Card>

      {!consent?.aiAllowed ? <AiConsentPanel onPrivacy={() => navigation.navigate('PrivacyPolicy')} /> : null}
      {consentError ? <Text accessibilityLiveRegion="polite" style={styles.qualityText}>{consentError}</Text> : null}
      <View style={styles.actions}>
        <PrimaryButton
          disabled={sending || checking || !report || report.status === 'blocked' || !consent?.aiAllowed}
          label={
            checking
              ? 'בודק תמונה...'
              : report?.status === 'blocked'
                ? 'נדרש צילום חדש'
                : 'שלח לניתוח'
          }
          icon="results"
          onPress={continueToResults}
        />
        <Pressable
          onPress={retakeImage}
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
        >
          <LineIcon name="camera" color={colors.primaryDark} size={17} />
          <Text style={styles.secondaryButtonText}>צלם שוב</Text>
        </Pressable>
      </View>
      <View style={styles.details}>
        <DisclosureSection title="פרטי הצילום">
          <Text style={styles.qualityText}>
            הבדיקה המקומית מסננת בעיות צילום בסיסיות. היא אינה מאמתת את סוג הסטיק או את דיוק המדידה.
          </Text>
          {session.captureMetadata?.source === 'gallery' ? (
            <Text style={styles.qualityText}>השתמש בתמונה שצולמה בזמן הקריאה שעל האריזה.</Text>
          ) : null}
          {session.captureMetadata?.timing === 'timer' &&
          session.captureMetadata.dippedAt &&
          session.captureMetadata.capturedAt ? (
            <Text style={styles.qualityText}>
              הצילום התחיל{' '}
              {Math.round(
                (session.captureMetadata.capturedAt - session.captureMetadata.dippedAt) / 1000,
              )}{' '}
              שניות לאחר ההוצאה מהמים; זמן ההמתנה שהוגדר: {session.captureMetadata.readDelaySeconds}{' '}
              שניות.
            </Text>
          ) : null}
        </DisclosureSection>
      </View>
      <Modal
        visible={enlarged}
        transparent
        animationType="fade"
        onRequestClose={() => setEnlarged(false)}
      >
        <View style={styles.zoomBackdrop}>
          <Image source={{ uri: imageUri }} resizeMode="contain" style={styles.zoomImage} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setEnlarged(false)}
            style={styles.zoomClose}
          >
            <Text style={styles.secondaryButtonText}>חזרה לאישור</Text>
          </Pressable>
        </View>
      </Modal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  details: { marginTop: 14 },
  qualityTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    ...rtl.text,
  },
  qualityText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 20,
    ...rtl.text,
  },
  zoomBackdrop: {
    flex: 1,
    backgroundColor: '#102C38',
    padding: 24,
    paddingTop: 50,
    paddingBottom: 40,
  },
  zoomImage: { flex: 1, width: '100%' },
  zoomClose: { marginTop: 16, padding: 16, borderRadius: 16, backgroundColor: colors.surface },
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
    height: 260,
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
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    flexDirection: 'row-reverse',
    gap: 6,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  previewPillText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  qualityCard: {
    gap: 10,
    marginTop: 12,
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
