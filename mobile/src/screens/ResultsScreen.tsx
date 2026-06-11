import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultRow } from '../components/ResultRow';
import { LineIcon } from '../components/LineIcon';
import { colors, rtl, typography } from '../theme';
import type { StripAnalysisResult } from '../domain/scanResults';
import { calculateDosage } from '../domain/dosage';
import { analyzeStripImage, getStripAnalysisConfig } from '../services/stripAnalysisService';
import { prepareScanImageForRemoteAnalysis } from '../services/scanImageStorage';
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
  }).format(new Date(timestamp));
}

function formatDisplayValue(value: number) {
  return Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
}

function formatRangeLabel(analysisResult: StripAnalysisResult, parameterIndex: number) {
  const parameter = analysisResult.parameters[parameterIndex];
  return parameter.unit ? `${parameter.idealRange.label} ${parameter.unit}` : parameter.idealRange.label;
}

function formatAnalysisSource(analysisResult: StripAnalysisResult) {
  const confidence = typeof analysisResult.confidence === 'number' ? ` · ביטחון ${Math.round(analysisResult.confidence * 100)}%` : '';
  const provider = analysisResult.provider ? ` · ${analysisResult.provider}` : '';
  const model = analysisResult.model ? ` · ${analysisResult.model}` : '';

  if (analysisResult.source === 'ai') {
    return `מקור ניתוח: AI${provider}${model}${confidence}`;
  }

  if (analysisResult.source === 'cv') {
    return `מקור ניתוח: CV fallback${confidence}`;
  }

  if (analysisResult.source === 'remote-v1') {
    return `מקור ניתוח: remote-v1${confidence}`;
  }

  if (analysisResult.source === 'remote-mock') {
    return `מקור ניתוח: remote-mock${confidence}`;
  }

  return `מקור ניתוח: mock${confidence}`;
}

export function ResultsScreen({ navigation, route }: Props) {
  const { accountId, user } = useAuth();
  const { getHistoryRecord, isHydrated, saveAnalysisResult } = useResultsHistory();
  const { getPool } = usePools();
  const {
    ensureTestId,
    resetScanSession,
    session,
    setAnalysisResult: setSessionAnalysisResult,
    setCurrentStep,
    setScanImageUpload,
    setScanError,
  } = useScanSession();
  const [analysisResult, setAnalysisResult] = useState<StripAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const savedTestId = route.params?.testId;
  const savedRecord = savedTestId ? getHistoryRecord(savedTestId) : undefined;
  const inputBrandId = savedTestId ? route.params?.brandId : session.selectedBrandId ?? route.params?.brandId;
  const inputImageUri = savedTestId ? route.params?.imageUri : session.confirmedImageUri ?? session.imageUri ?? route.params?.imageUri;
  const inputImagePath = savedTestId ? undefined : session.imagePath ?? route.params?.imagePath;
  const inputImageUrl = savedTestId ? undefined : session.imageUrl ?? route.params?.imageUrl;
  const poolId = savedRecord?.poolId ?? (savedTestId ? route.params?.poolId : session.selectedPoolId ?? route.params?.poolId);
  const pool = poolId ? getPool(poolId) : undefined;
  const poolName = savedRecord?.poolName ?? pool?.name ?? FALLBACK_POOL_NAME;
  const imageDisplayUri = savedRecord?.imageUrl ?? savedRecord?.imageUri ?? inputImageUri;
  const hasImage = Boolean(imageDisplayUri);
  const isSavedResult = Boolean(savedTestId);

  useEffect(() => {
    let isMounted = true;

    async function analyzeImage() {
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
    }

    analyzeImage();

    return () => {
      isMounted = false;
    };
  }, [
    isHydrated,
    inputBrandId,
    inputImagePath,
    inputImageUri,
    inputImageUrl,
    pool,
    poolId,
    route.params?.brandId,
    route.params?.imageUri,
    route.params?.poolId,
    accountId,
    session.analysisResult,
    session.dosageResult,
    session.imagePath,
    session.imageUrl,
    session.testId,
    savedRecord,
    savedTestId,
    ensureTestId,
    setCurrentStep,
    setScanImageUpload,
    setScanError,
    setSessionAnalysisResult,
    user?.id,
  ]);

  function handleSave() {
    if (!analysisResult) {
      return;
    }

    saveAnalysisResult(analysisResult);
    resetScanSession();
    navigation.navigate('History');
  }

  if (savedTestId && isHydrated && !analysisResult) {
    return (
      <AppShell activeTab="history" navigation={navigation}>
        <View style={styles.header}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.poolName}>בדיקה לא נמצאה</Text>
          <Text style={styles.subtitle}>ייתכן שהרשומה נמחקה או שעדיין לא נשמרה מקומית.</Text>
        </View>

        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <LineIcon name="history" color={colors.primaryDark} size={16} />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.analyzingTitle}>אין תוצאה שמורה</Text>
            <Text style={styles.analyzingText}>חזרו להיסטוריה או התחילו סריקה חדשה עבור הבריכה.</Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  if (!savedTestId && !inputImageUri && !analysisResult) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
        <View style={styles.header}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.poolName}>אין תמונה לניתוח</Text>
          <Text style={styles.subtitle}>בחרו או אשרו תמונת סטיק לפני שמציגים תוצאות.</Text>
        </View>

        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <LineIcon name="image" color={colors.primaryDark} size={16} />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.analyzingTitle}>חסר צילום סטיק</Text>
            <Text style={styles.analyzingText}>חזרו למסך הסריקה ובחרו תמונה ברורה של הסטיק.</Text>
          </View>
        </Card>

        <View style={styles.saveButton}>
          <PrimaryButton label="חזרה לסריקה" icon="scan" onPress={() => navigation.replace('Scan')} />
        </View>
      </AppShell>
    );
  }

  if (isAnalyzing || !analysisResult) {
    return (
      <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
        <View style={styles.header}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.poolName}>{poolName}</Text>
          <Text style={styles.subtitle}>מנתח את תמונת הסטיק...</Text>
        </View>

        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <ActivityIndicator color={colors.primaryDark} size="small" />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.analyzingTitle}>ניתוח בדיקה בפעולה</Text>
            <Text style={styles.analyzingText}>אנחנו מנתחים את תמונת הסטיק ומכינים את תוצאות הבדיקה.</Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>תוצאות הבדיקה</Text>
        <Text style={styles.poolName}>{poolName}</Text>
        <Text style={styles.subtitle}>{formatAnalysisDate(analysisResult.analyzedAt)}</Text>
      </View>

      <View style={styles.resultsList}>
        {isSavedResult && imageDisplayUri ? (
          <Card compact style={styles.savedImageCard}>
            <Image source={{ uri: imageDisplayUri }} style={styles.savedImage} resizeMode="cover" />
            <View style={styles.savedImageCopy}>
              <Text style={styles.savedImageTitle}>תמונת הסטיק</Text>
              <Text style={styles.savedImageText}>
                {savedRecord?.imageUrl ? 'נטענה מהענן' : 'מוצגת מהשמירה המקומית'}
              </Text>
            </View>
          </Card>
        ) : null}

        {hasImage ? (
          <View style={styles.imageReceived}>
            <View style={styles.imageReceivedIcon}>
              <LineIcon name="image" color={colors.primaryDark} size={15} />
            </View>
            <Text style={styles.imageReceivedText}>{formatAnalysisSource(analysisResult)}</Text>
          </View>
        ) : null}

        {analysisResult.parameters.map((parameter, index) => (
          <ResultRow
            key={parameter.key}
            label={parameter.name}
            progress={parameter.progress}
            range={formatRangeLabel(analysisResult, index)}
            status={parameter.status.label}
            tone={parameter.status.tone}
            value={formatDisplayValue(parameter.value)}
          />
        ))}
      </View>

      <Card compact style={styles.recommendation}>
        <View style={styles.recommendationIcon}>
          <LineIcon name="drop" color={colors.primaryDark} size={15} />
        </View>
        <View style={styles.recommendationCopy}>
          <Text style={styles.recommendationTitle}>המלצה</Text>
          <Text style={styles.recommendationText}>{analysisResult.recommendation}</Text>
          {analysisResult.dosage?.retestNote ? <Text style={styles.noteText}>{analysisResult.dosage.retestNote}</Text> : null}
          {analysisResult.dosage?.safetyNote ? <Text style={styles.safetyText}>{analysisResult.dosage.safetyNote}</Text> : null}
        </View>
      </Card>

      {isSavedResult ? null : (
        <View style={styles.saveButton}>
        <PrimaryButton label="סיום ושמירה" icon="history" onPress={handleSave} />
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
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
  poolName: {
    marginTop: 10,
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 7,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.textCenter,
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
  analyzingTitle: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  analyzingText: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
    ...rtl.text,
  },
  resultsList: {
    marginTop: 18,
    gap: 11,
  },
  savedImageCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  savedImage: {
    width: 70,
    height: 70,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
  },
  savedImageCopy: {
    flex: 1,
  },
  savedImageTitle: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  savedImageText: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  imageReceived: {
    minHeight: 42,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  imageReceivedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageReceivedText: {
    flex: 1,
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  recommendation: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
  },
  recommendationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationCopy: {
    flex: 1,
  },
  recommendationTitle: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  recommendationText: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    ...rtl.text,
  },
  noteText: {
    marginTop: 8,
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 18,
    ...rtl.text,
  },
  safetyText: {
    marginTop: 6,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 17,
    ...rtl.text,
  },
  saveButton: {
    marginTop: 16,
  },
});
