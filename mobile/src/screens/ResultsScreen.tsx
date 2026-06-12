import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { LowConfidenceWarning } from '../components/LowConfidenceWarning';
import { ParameterArcs } from '../components/ParameterArcs';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { DosageRecommendation } from '../domain/dosage';
import { calculateDosage } from '../domain/dosage';
import type { ScanResultParameter, StripAnalysisResult } from '../domain/scanResults';
import { analyzeStripImage, getStripAnalysisConfig } from '../services/stripAnalysisService';
import { prepareScanImageForRemoteAnalysis } from '../services/scanImageStorage';
import { useAppPreferences } from '../state/AppPreferencesContext';
import { useAuth } from '../state/AuthContext';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
const FALLBACK_POOL_NAME = 'הבריכה שלי';

function formatAnalysisDate(timestamp: number) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function formatVolume(volumeLiters?: number) {
  if (!volumeLiters || volumeLiters <= 0) return undefined;
  return `${Math.round(volumeLiters).toLocaleString('he-IL')} ליטר`;
}

function targetForParameter(parameter: ScanResultParameter) {
  return Number(((parameter.idealRange.min + parameter.idealRange.max) / 2).toFixed(parameter.key === 'ph' ? 1 : 0));
}

function mapParameterToRecommendation(parameter: ScanResultParameter): DosageRecommendation {
  return {
    actionHe: parameter.recommendation,
    blocked: parameter.status.kind !== 'ok',
    exactAmountAvailable: false,
    labelHe: parameter.name,
    measured: parameter.value,
    paramKey: parameter.key,
    status: parameter.status.kind,
    target: targetForParameter(parameter),
    unit: parameter.unit,
  };
}

function getResultCards(result: StripAnalysisResult): DosageRecommendation[] {
  if (result.dosage?.recommendations?.length) {
    return result.dosage.recommendations;
  }

  return result.parameters.map(mapParameterToRecommendation);
}

function SafetyCard({ text }: { text?: string }) {
  return (
    <View style={styles.safetyCard}>
      <View style={styles.safetyIcon}>
        <LineIcon name="help" color={colors.warning} size={15} />
      </View>
      <Text style={styles.safetyText}>
        {text ||
          'החישוב הוא הערכה לפי נתוני הבריכה ותוצאת הסטיק. יש לפעול לפי הוראות יצרן חומרי הבריכה, להוסיף חומרים בהדרגה, לבדוק שוב, ולא לערבב חומרים שונים ישירות.'}
      </Text>
    </View>
  );
}

function getAnalysisSourceLabel(result: StripAnalysisResult) {
  if (result.source === 'ai') return 'ניתוח AI';
  if (result.source === 'cv' || result.source === 'remote-v1') return 'ניתוח פיקסלים';
  if (result.source === 'mock' || result.source === 'remote-mock') return 'ערכי דמו';
  return 'ניתוח אוטומטי';
}

function AnalysisDebugCard({ result }: { result: StripAnalysisResult }) {
  const confidence = typeof result.confidence === 'number' ? `${Math.round(result.confidence * 100)}%` : 'לא זמין';
  const details = [result.provider, result.model, result.shotsUsed ? `${result.shotsUsed} ריצות` : undefined].filter(Boolean).join(' · ');

  return (
    <Card compact style={styles.debugCard}>
      <View style={styles.debugHeader}>
        <View style={styles.debugIcon}>
          <LineIcon name="settings" color={colors.primaryDark} size={14} />
        </View>
        <Text style={styles.debugTitle}>{getAnalysisSourceLabel(result)}</Text>
      </View>
      <Text style={styles.debugText}>ביטחון: {confidence}</Text>
      {details ? <Text style={styles.debugText}>{details}</Text> : null}
      {result.notes ? <Text style={styles.debugNote}>{result.notes}</Text> : null}
    </Card>
  );
}

export function ResultsScreen({ navigation, route }: Props) {
  const { showTechnicalAnalysisDetails } = useAppPreferences();
  const { accountId, user } = useAuth();
  const { getHistoryRecord, isHydrated, saveAnalysisResult } = useResultsHistory();
  const { getPool } = usePools();
  const {
    ensureTestId,
    resetScanSession,
    session,
    setAnalysisResult: setSessionAnalysisResult,
    setCurrentStep,
    setScanError,
    setScanImageUpload,
  } = useScanSession();
  const [analysisResult, setAnalysisResult] = useState<StripAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const savedTestId = route.params?.testId;
  const savedRecord = savedTestId ? getHistoryRecord(savedTestId) : undefined;
  const inputBrandId = savedTestId ? route.params?.brandId : session.selectedBrandId ?? route.params?.brandId;
  const inputImageUri = savedTestId ? route.params?.imageUri : session.confirmedImageUri ?? session.imageUri ?? route.params?.imageUri;
  const inputImagePath = savedTestId ? undefined : session.imagePath ?? route.params?.imagePath;
  const inputImageUrl = savedTestId ? undefined : session.imageUrl ?? route.params?.imageUrl;
  const poolId = savedRecord?.poolId ?? (savedTestId ? route.params?.poolId : session.selectedPoolId ?? route.params?.poolId);
  const pool = poolId ? getPool(poolId) : undefined;
  const poolName = savedRecord?.poolName ?? pool?.name ?? FALLBACK_POOL_NAME;
  const isSavedResult = Boolean(savedTestId);

  useEffect(() => {
    let isMounted = true;

    async function analyzeImage() {
      try {
        setAnalysisError('');
        if (savedTestId) {
          if (!isHydrated) {
            setIsAnalyzing(true);
            return;
          }

          if (savedRecord?.analysisResult) {
            setAnalysisResult({
              ...savedRecord.analysisResult,
              dosage: savedRecord.dosageResult ?? savedRecord.analysisResult.dosage,
            });
          } else {
            setAnalysisResult(null);
          }
          setIsAnalyzing(false);
          return;
        }

        if (session.analysisResult) {
          setAnalysisResult({
            ...session.analysisResult,
            dosage: session.dosageResult ?? session.analysisResult.dosage,
          });
          setIsAnalyzing(false);
          return;
        }

        if (!inputImageUri) {
          setScanError({
            code: 'missingImage',
            message: 'בחרו או אשרו תמונת סטיק לפני הצגת תוצאות.',
          });
          setAnalysisResult(null);
          setIsAnalyzing(false);
          return;
        }

        setCurrentStep('analyzing');
        setIsAnalyzing(true);
        const testId = session.testId ?? ensureTestId();
        let imagePath = inputImagePath;
        let imageUrl = inputImageUrl;
        let imageUploadError: string | undefined;
        const analysisMode = getStripAnalysisConfig().mode;

        if ((analysisMode === 'remote' || analysisMode === 'auto') && accountId && user?.id && !imagePath && !imageUrl) {
          const preparedImage = await prepareScanImageForRemoteAnalysis({
            accountId,
            imageUri: inputImageUri,
            testId,
            userId: user.id,
          });

          imagePath = preparedImage.imagePath;
          imageUrl = preparedImage.imageUrl;
          imageUploadError = preparedImage.uploadError;
        }

        const result = await analyzeStripImage({
          accountId,
          brandId: inputBrandId,
          imagePath,
          imageUrl,
          imageUri: inputImageUri,
          poolId,
          qualityNotes: session.qualityNotes,
          scanSession: session,
          selectedBrand: session.selectedBrand,
          skipImageUpload: Boolean(imagePath || imageUrl),
          testId,
          userId: user?.id,
        });
        const dosage = calculateDosage(result, pool);
        const enrichedResult: StripAnalysisResult = {
          ...result,
          id: testId,
          dosage,
          imagePath: result.imagePath ?? imagePath,
          imageUrl: result.imageUrl ?? imageUrl,
          overallStatus: {
            label: dosage.primaryRecommendation ? 'נדרש תיקון קל' : 'המים מאוזנים',
            tone: dosage.primaryRecommendation ? 'warning' : 'success',
          },
          recommendation: dosage.summary,
        };

        if (isMounted) {
          setAnalysisResult(enrichedResult);
          setSessionAnalysisResult(enrichedResult);
          setScanImageUpload({
            imagePath: enrichedResult.imagePath,
            imageUrl: enrichedResult.imageUrl,
            imageUploadError,
            testId,
          });
          setIsAnalyzing(false);
        }
      } catch (error) {
        console.warn('Failed to prepare results', error);
        if (isMounted) {
          const message = 'לא הצלחנו להשלים את ניתוח הבדיקה כרגע. אפשר לנסות שוב או לחזור לסריקה.';
          setScanError({ code: 'analysisFailed', message });
          setAnalysisError(message);
          setAnalysisResult(null);
          setIsAnalyzing(false);
        }
      }
    }

    analyzeImage();

    return () => {
      isMounted = false;
    };
  }, [
    accountId,
    ensureTestId,
    inputBrandId,
    inputImagePath,
    inputImageUri,
    inputImageUrl,
    isHydrated,
    pool,
    poolId,
    retryKey,
    savedRecord,
    savedTestId,
    session.analysisResult,
    session.confirmedImageUri,
    session.dosageResult,
    session.imagePath,
    session.imageUri,
    session.imageUrl,
    session.qualityNotes,
    session.selectedBrand,
    session.selectedBrandId,
    session.selectedPoolId,
    session.testId,
    setCurrentStep,
    setScanError,
    setScanImageUpload,
    setSessionAnalysisResult,
    user?.id,
  ]);

  const resultCards = useMemo(() => (analysisResult ? getResultCards(analysisResult) : []), [analysisResult]);
  const volumeLabel = formatVolume(pool?.volumeLiters);

  function handleSave() {
    if (!analysisResult) return;
    saveAnalysisResult(analysisResult);
    resetScanSession();
    navigation.navigate('History');
  }

  function handleNewScan() {
    resetScanSession();
    navigation.navigate('SelectStrip', poolId ? { poolId } : undefined);
  }

  if (savedTestId && isHydrated && !analysisResult) {
    return (
      <AppShell activeTab="history" navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>בדיקה לא נמצאה</Text>
        </View>
        <Card compact style={styles.messageCard}>
          <Text style={styles.messageTitle}>אין תוצאה שמורה</Text>
          <Text style={styles.messageText}>ייתכן שהרשומה נמחקה או שעדיין לא נשמרה מקומית.</Text>
        </Card>
      </AppShell>
    );
  }

  if (!savedTestId && !inputImageUri && !analysisResult) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>אין תמונה לניתוח</Text>
        </View>
        <Card compact style={styles.messageCard}>
          <Text style={styles.messageTitle}>חסר צילום סטיק</Text>
          <Text style={styles.messageText}>חזרו למסך הסריקה ובחרו תמונה ברורה של הסטיק.</Text>
        </Card>
        <View style={styles.primaryAction}>
          <PrimaryButton label="חזרה לסריקה" icon="scan" onPress={() => navigation.replace('Scan')} />
        </View>
      </AppShell>
    );
  }

  if (analysisError && !analysisResult) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>הניתוח לא הושלם</Text>
        </View>
        <Card compact style={styles.messageCard}>
          <Text style={styles.messageTitle}>משהו השתבש בדרך</Text>
          <Text style={styles.messageText}>{analysisError}</Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton label="נסה שוב" icon="scan" onPress={() => setRetryKey((current) => current + 1)} />
          <Pressable style={styles.secondaryButton} onPress={() => navigation.replace('Scan', poolId ? { poolId, brandId: inputBrandId } : undefined)}>
            <LineIcon name="camera" color={colors.primaryDark} size={16} />
            <Text style={styles.secondaryText}>חזרה לסריקה</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  if (isAnalyzing || !analysisResult) {
    return (
      <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>מנתח את תמונת הסטיק...</Text>
        </View>
        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <ActivityIndicator color={colors.primaryDark} size="small" />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.messageTitle}>ניתוח בדיקה בפעולה</Text>
            <Text style={styles.messageText}>אנחנו מנתחים את תמונת הסטיק ומכינים את תוצאות הבדיקה.</Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
      <View style={styles.heroCard}>
        <View pointerEvents="none" style={styles.heroGlowLeft} />
        <View pointerEvents="none" style={styles.heroGlowRight} />
        <Text style={styles.heroKicker}>תוצאות הבדיקה</Text>
        <Text style={styles.heroTitle}>{poolName}</Text>
        <Text style={styles.heroMeta}>
          {[volumeLabel, formatAnalysisDate(analysisResult.analyzedAt)].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {analysisResult.lowConfidence ? <LowConfidenceWarning /> : null}

      {session.imageUploadError && !isSavedResult ? (
        <Card compact style={styles.warningCard}>
          <Text style={styles.warningTitle}>התמונה נשמרה מקומית</Text>
          <Text style={styles.warningText}>{session.imageUploadError}</Text>
        </Card>
      ) : null}

      {showTechnicalAnalysisDetails ? <AnalysisDebugCard result={analysisResult} /> : null}

      <View style={styles.section}>
        <ParameterArcs recs={resultCards} />
      </View>

      <View style={styles.cardsList}>
        {resultCards.map((rec) => (
          <ResultCard key={rec.paramKey} rec={rec} />
        ))}
      </View>

      <SafetyCard text={analysisResult.dosage?.safetyNote} />

      <View style={styles.actions}>
        {isSavedResult ? (
          <>
            <PrimaryButton label="בדיקה חדשה" icon="camera" onPress={handleNewScan} />
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('History')}>
              <LineIcon name="history" color={colors.primaryDark} size={16} />
              <Text style={styles.secondaryText}>חזור להיסטוריה</Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Pools')}>
              <LineIcon name="pools" color={colors.primaryDark} size={16} />
              <Text style={styles.secondaryText}>חזור לבריכות שלי</Text>
            </Pressable>
          </>
        ) : (
          <PrimaryButton label="סיום ושמירה" icon="history" onPress={handleSave} />
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  emptyHeader: {
    marginTop: 18,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 8,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  heroCard: {
    marginTop: 14,
    minHeight: 134,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    padding: 20,
    justifyContent: 'center',
    ...shadows.hero,
  },
  heroGlowLeft: {
    position: 'absolute',
    left: -34,
    bottom: -42,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroGlowRight: {
    position: 'absolute',
    right: -24,
    top: -28,
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroKicker: {
    color: colors.whiteMuted,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    ...rtl.text,
  },
  heroTitle: {
    marginTop: 5,
    color: colors.white,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 25,
    fontWeight: '900',
    ...rtl.text,
  },
  heroMeta: {
    marginTop: 5,
    color: colors.whiteMuted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  section: {
    marginTop: 16,
  },
  cardsList: {
    marginTop: 14,
    gap: 11,
  },
  safetyCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(240,165,41,0.28)',
    backgroundColor: colors.warningSoft,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningCard: {
    marginTop: 12,
    borderColor: 'rgba(240,165,41,0.28)',
    backgroundColor: colors.warningSoft,
  },
  warningTitle: {
    color: colors.warning,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  warningText: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  debugCard: {
    marginTop: 12,
    gap: 5,
    backgroundColor: colors.surfaceSoft,
  },
  debugHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  debugIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  debugTitle: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  debugText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.text,
  },
  debugNote: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 16,
    ...rtl.text,
  },
  safetyIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyText: {
    flex: 1,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  actions: {
    marginTop: 18,
    gap: 9,
  },
  primaryAction: {
    marginTop: 16,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  messageCard: {
    marginTop: 20,
  },
  analyzingCard: {
    marginTop: 22,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  analyzingIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingCopy: {
    flex: 1,
  },
  messageTitle: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  messageText: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
});
