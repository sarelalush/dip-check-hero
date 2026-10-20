import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { LowConfidenceWarning } from '../components/LowConfidenceWarning';
import type { ParameterArcReading } from '../components/ParameterArcs';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultCard } from '../components/ResultCard';
import { TotalChlorineReadingCard } from '../components/TotalChlorineReadingCard';
import { totalChlorinePresentation } from '../domain/chlorinePresentation';
import { ResultOverview } from '../components/ResultOverview';
import { colors, radius, rtl, typography } from '../theme';
import type { DosageRecommendation } from '../domain/dosage';
import { calculateDosage, protectAnalysisResult, MEASUREMENT_SAFETY_NOTE } from '../domain/dosage';
import type { Pool } from '../domain/pool';
import type { ScanResultParameter, StripAnalysisResult } from '../domain/scanResults';
import { useStartScanFlow } from '../hooks/useStartScanFlow';
import {
  analyzeStripImage,
  getStripAnalysisConfig,
  StripAnalysisServiceError,
} from '../services/stripAnalysisService';
import { prepareScanImageForRemoteAnalysis } from '../services/scanImageStorage';
import { fetchCloudTestById } from '../services/testCloudSync';
import { useAuth } from '../state/AuthContext';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory, type SavedHistoryRecord } from '../state/ResultsHistoryContext';
import { useScanSession } from '../state/ScanSessionContext';
import type { RootStackParamList } from '../../App';
import { resultStatus } from '../domain/resultPresentation';
import { getChlorineReview, comparisonKind, needsReadingVerification, readingNeedsClarification } from '../domain/readingComparison';
import { PARAM_LABEL_HE } from '../domain/strip';
import { NextActionCard } from '../components/NextActionCard';
import { DisclosureSection } from '../components/DisclosureSection';
import { requireCurrentAiConsent } from '../services/legalConsentService';
import { GuidanceSources } from '../components/GuidanceSources';
import { buildMetricGuidance } from '../domain/metricGuidance';
import { usePadPhotoColors } from '../hooks/usePadPhotoColors';

type Props = NativeStackScreenProps<RootStackParamList, 'Results'>;
const FALLBACK_POOL_NAME = 'הבריכה שלי';
const autoSavedResultIds = new Set<string>();
const PRO_PAD_POSITION: Partial<Record<DosageRecommendation['paramKey'], number>> = {
  totalChlorine: 1, freeChlorine: 2, ph: 3, alkalinity: 4,
};
const CORE_RESULT_PARAMETER_ORDER: DosageRecommendation['paramKey'][] = [
  'freeChlorine',
  'ph',
  'alkalinity',
];
const CORE_RESULT_PARAMETER_KEYS = new Set<DosageRecommendation['paramKey']>(
  CORE_RESULT_PARAMETER_ORDER,
);

function formatAnalysisDate(timestamp: number) {
  return new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function targetForParameter(parameter: ScanResultParameter) {
  return Number(
    ((parameter.idealRange.min + parameter.idealRange.max) / 2).toFixed(
      parameter.key === 'ph' ? 1 : 0,
    ),
  );
}

function mapParameterToRecommendation(parameter: ScanResultParameter): DosageRecommendation {
  return {
    actionHe: parameter.recommendation,
    guidance: buildMetricGuidance(parameter),
    verificationSuggested: needsReadingVerification(parameter),
    actionUncertain: readingNeedsClarification(parameter),
    alternativeMeasured: parameter.evidence?.modelCertainty === 'adjacent'
      ? parameter.evidence.alternativeValue : undefined,
    blocked: comparisonKind(parameter) !== 'ok',
    exactAmountAvailable: false,
    labelHe: PARAM_LABEL_HE[parameter.key].labelHe,
    measured: parameter.value,
    paramKey: parameter.key,
    status: comparisonKind(parameter)!,
    target: targetForParameter(parameter),
    comparisonRange: { min: parameter.idealRange.min, max: parameter.idealRange.max },
    unit: parameter.unit,
  };
}

function getResultCards(result: StripAnalysisResult): DosageRecommendation[] {
  const recommendations = result.dosage?.recommendations
    ?? result.parameters.filter((parameter) => comparisonKind(parameter) !== undefined).map(mapParameterToRecommendation);

  const safeRecommendations = isInvalidStripResult(result)
    ? recommendations.map((rec) => ({ ...rec, guidance: undefined })) : recommendations;
  const coreRecommendations = CORE_RESULT_PARAMETER_ORDER.map((paramKey) =>
    safeRecommendations.find((recommendation) => recommendation.paramKey === paramKey),
  ).filter((recommendation): recommendation is DosageRecommendation => Boolean(recommendation));

  if (coreRecommendations.length) {
    return coreRecommendations;
  }

  return safeRecommendations
    .filter((recommendation) => CORE_RESULT_PARAMETER_KEYS.has(recommendation.paramKey))
    .slice(0, 3);
}

function isInvalidStripResult(result?: StripAnalysisResult | null) {
  if (!result) return false;
  return (
    result.accepted === false ||
    result.isValidStrip === false ||
    result.lowConfidence === true ||
    Boolean(result.failureReason && result.failureReason !== 'none')
  );
}

function enrichResultWithDosage(
  result: StripAnalysisResult,
  pool?: Pool,
  savedDosage?: StripAnalysisResult['dosage'],
): StripAnalysisResult {
  void savedDosage;
  const safeResult = protectAnalysisResult(result, pool);
  const dosage = isInvalidStripResult(result) ? undefined : safeResult.dosage;

  if (!dosage || isInvalidStripResult(result)) {
    return {
      ...safeResult,
      dosage,
    };
  }

  return {
    ...safeResult,
    dosage,
    overallStatus: resultStatus({ ...result, dosage }),
    recommendation: dosage.summary ?? result.recommendation,
  };
}

function normalizeRepeatedMessage(message?: string) {
  if (!message) return '';

  const parts = message
    .split(/(?<=[.!?。！？])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (!parts.length) {
    return message.trim();
  }

  const seen = new Set<string>();
  const uniqueParts: string[] = [];

  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    uniqueParts.push(part);
  }

  return uniqueParts.join(' ');
}

function invalidStripTitle(result: StripAnalysisResult) {
  switch (result.failureReason) {
    case 'low_confidence': return 'לא התקבלה קריאה אמינה';
    case 'blurry': return 'התמונה אינה חדה מספיק';
    case 'lighting': return 'התאורה מקשה על קריאת הצבעים';
    case 'framing': return 'לא ניתן לקרוא את כל הפדים';
    case 'unsupported_strip': return 'סוג הסטיק אינו תואם';
    default: return 'לא זוהה סטיק מתאים';
  }
}

function invalidStripMessage(result?: StripAnalysisResult | null) {
  if (!result)
    return 'לא הצלחנו לזהות סטיק בדיקה תקין בתמונה. יש לצלם שוב סטיק ברור ומלא בתוך המסגרת.';
  if (result.failureReason === 'unsupported_strip') {
    return (
      normalizeRepeatedMessage(result.notes) ||
      'הסטיק שצולם אינו תואם לסוג הסטיק שנבחר או אינו נתמך. יש לבחור סטיק נתמך ולצלם שוב.'
    );
  }
  if (result.failureReason === 'blurry') {
    return (
      normalizeRepeatedMessage(result.notes) ||
      'התמונה מטושטשת מדי לניתוח. יש לצלם שוב תמונה חדה של הסטיק כולו.'
    );
  }
  if (result.failureReason === 'lighting') {
    return (
      normalizeRepeatedMessage(result.notes) ||
      'התאורה בתמונה לא מתאימה לניתוח אמין. יש לצלם שוב באור ברור ואחיד.'
    );
  }
  if (result.failureReason === 'framing') {
    return (
      normalizeRepeatedMessage(result.notes) ||
      'הסטיק לא הופיע במלואו בתוך המסגרת. יש לצלם שוב כשהסטיק כולו נראה בבירור.'
    );
  }
  if (result.failureReason === 'low_confidence') {
    return (
      normalizeRepeatedMessage(result.notes) ||
      'לא ניתן לקרוא את המדדים בוודאות מהצילום הזה. נדרשת תמונה חדשה לקריאה נוספת.'
    );
  }
  return (
    normalizeRepeatedMessage(result.notes) ||
    'לא זוהה סטיק בדיקה תקין בתמונה. יש לצלם שוב סטיק ברור ומלא בתוך המסגרת.'
  );
}

function uniqueIds(ids: Array<string | undefined | null>) {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

function fallbackAnalysisResultFromRecord(record: SavedHistoryRecord): StripAnalysisResult {
  return {
    id: record.cloudId ?? record.testId,
    analyzedAt: record.testedAt,
    brandId: record.brandId,
    imagePath: record.imagePath,
    imageUri: record.imageUri,
    imageUrl: record.imageUrl,
    poolId: record.poolId,
    lowConfidence: true,
    notes:
      'הבדיקה נשמרה, אך פירוט המדדים אינו זמין כרגע. נסו לרענן את ההיסטוריה או לפתוח שוב בעוד רגע.',
    overallStatus: {
      label: record.status,
      tone: record.tone,
    },
    parameters: [],
    recommendation: record.resultSummary,
    dosage: record.dosageResult,
  };
}

export function ResultsScreen({ navigation, route }: Props) {
  const { accountId, loading: authLoading, user } = useAuth();
  const { getHistoryRecord, getPoolHistoryRecords, isHydrated, saveAnalysisResult } =
    useResultsHistory();
  const { getPool, pools } = usePools();
  const {
    resetScanSession,
    startScanSession,
    session,
    setAnalysisResult: setSessionAnalysisResult,
    setCurrentStep,
    setScanError,
    setScanImageUpload,
  } = useScanSession();
  const startScanFlow = useStartScanFlow(navigation);
  const [analysisResult, setAnalysisResult] = useState<StripAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [autoSaved, setAutoSaved] = useState(false);
  const autoSavedTestIdRef = useRef<string | undefined>(undefined);
  const activeAnalysisKeyRef = useRef<string | null>(null);
  const screenMountedRef = useRef(true);
  const savedTestId = route.params?.testId;
  const savedRecord = savedTestId ? getHistoryRecord(savedTestId) : undefined;
  const inputBrandId = savedTestId
    ? route.params?.brandId
    : (session.selectedBrandId ?? route.params?.brandId);
  const inputImageUri = savedTestId
    ? route.params?.imageUri
    : (session.confirmedImageUri ?? session.imageUri ?? route.params?.imageUri);
  const inputImagePath = savedTestId ? undefined : (session.imagePath ?? route.params?.imagePath);
  const inputImageUrl = savedTestId ? undefined : (session.imageUrl ?? route.params?.imageUrl);
  const poolId =
    savedRecord?.poolId ??
    (savedTestId ? route.params?.poolId : (session.selectedPoolId ?? route.params?.poolId));
  const pool = poolId ? getPool(poolId) : undefined;
  const poolName = savedRecord?.poolName ?? pool?.name ?? FALLBACK_POOL_NAME;
  const savedRecordAccountId = savedRecord?.accountId;
  const isSavedResult = Boolean(savedTestId);
  const activeScanTestId = savedTestId ? undefined : (route.params?.scanTestId ?? session.testId);
  const visibleAnalysisResult = savedTestId
    ? analysisResult
    : analysisResult && activeScanTestId && analysisResult.id === activeScanTestId
      ? analysisResult
      : null;

  useEffect(() => {
    screenMountedRef.current = true;
    return () => {
      screenMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function analyzeImage() {
      let analysisRequestKey: string | undefined;

      try {
        setAnalysisError('');
        if (savedTestId) {
          if (!isHydrated) {
            setIsAnalyzing(true);
            return;
          }

          if (savedRecord?.analysisResult) {
            setAnalysisResult(
              enrichResultWithDosage(savedRecord.analysisResult, pool, savedRecord.dosageResult),
            );
          } else if (authLoading) {
            setIsAnalyzing(true);
            return;
          } else if (accountId || savedRecordAccountId) {
            const candidateIds = uniqueIds([savedRecord?.cloudId, savedTestId]);
            const lookupAccountId = accountId ?? savedRecordAccountId;
            let cloudResult: StripAnalysisResult | null = null;

            for (const candidateId of candidateIds) {
              if (!lookupAccountId) break;
              const fullRecord = await fetchCloudTestById(candidateId, lookupAccountId, pools);
              if (fullRecord?.analysisResult) {
                cloudResult = enrichResultWithDosage(
                  fullRecord.analysisResult,
                  pool,
                  fullRecord.dosageResult,
                );
                break;
              }
            }

            setAnalysisResult(
              cloudResult ?? (savedRecord ? fallbackAnalysisResultFromRecord(savedRecord) : null),
            );
          } else {
            setAnalysisResult(savedRecord ? fallbackAnalysisResultFromRecord(savedRecord) : null);
          }
          setIsAnalyzing(false);
          return;
        }

        if (authLoading || !accountId || !user?.id) {
          setAnalysisResult(null);
          setIsAnalyzing(true);
          return;
        }

        if (
          session.analysisResult &&
          activeScanTestId &&
          session.analysisResult.id === activeScanTestId
        ) {
          setAnalysisResult(
            enrichResultWithDosage(session.analysisResult, pool, session.dosageResult),
          );
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

        if (!activeScanTestId) {
          const message = 'לא הצלחנו להכין את הסריקה לניתוח. חזרו למסך הצילום ונסו שוב.';
          setScanError({ code: 'analysisFailed', message });
          setAnalysisError(message);
          setAnalysisResult(null);
          setIsAnalyzing(false);
          return;
        }

        const testId = activeScanTestId;
        if (
          session.confirmedImageUri !== inputImageUri ||
          !session.imageQuality ||
          session.imageQuality.status === 'blocked'
        ) {
          throw new StripAnalysisServiceError(
            'unavailable',
            'יש להמתין לבדיקת איכות התמונה בתצוגה המקדימה לפני השליחה.',
          );
        }
        analysisRequestKey = `${testId}|${retryKey}`;
        await requireCurrentAiConsent();

        if (activeAnalysisKeyRef.current === analysisRequestKey) {
          return;
        }

        activeAnalysisKeyRef.current = analysisRequestKey;
        setAnalysisResult(null);
        setAutoSaved(false);
        setCurrentStep('analyzing');
        setIsAnalyzing(true);
        let imagePath = inputImagePath;
        let imageUrl = inputImageUrl;
        let imageUploadError: string | undefined;
        const analysisMode = getStripAnalysisConfig().mode;

        if (
          (analysisMode === 'remote' || analysisMode === 'auto') &&
          accountId &&
          user?.id &&
          !imagePath &&
          !imageUrl
        ) {
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
          poolId: pool?.cloudId ?? (/^[0-9a-f-]{36}$/i.test(poolId ?? '') ? poolId : undefined),
          qualityNotes: session.qualityNotes,
          scanSession: session,
          selectedBrand: session.selectedBrand,
          skipImageUpload: Boolean(imagePath || imageUrl),
          testId,
          userId: user?.id,
        });
        const dosage = isInvalidStripResult(result) ? undefined : calculateDosage(result, pool);
        const enrichedResult: StripAnalysisResult = {
          ...result,
          id: testId,
          poolId: result.poolId ?? pool?.id,
          dosage,
          captureMetadata: session.captureMetadata,
          imageQuality: session.imageQuality,
          imagePath: result.imagePath ?? imagePath,
          imageUrl: result.imageUrl ?? imageUrl,
          overallStatus: isInvalidStripResult(result)
            ? result.overallStatus
            : resultStatus({ ...result, dosage }),
          recommendation: isInvalidStripResult(result)
            ? result.recommendation
            : (dosage?.summary ?? result.recommendation),
        };

        if (
          screenMountedRef.current &&
          (!analysisRequestKey || activeAnalysisKeyRef.current === analysisRequestKey)
        ) {
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
        if (
          screenMountedRef.current &&
          (!analysisRequestKey || activeAnalysisKeyRef.current === analysisRequestKey)
        ) {
          const message =
            error instanceof StripAnalysisServiceError
              ? error.message
              : 'שירות הניתוח אינו זמין כרגע. אנא נסו שוב בעוד כמה דקות.';
          setScanError({ code: 'analysisFailed', message });
          setAnalysisError(message);
          setAnalysisResult(null);
          setIsAnalyzing(false);
        }
      }
    }

    analyzeImage();
  }, [
    accountId,
    activeScanTestId,
    authLoading,
    inputBrandId,
    inputImagePath,
    inputImageUri,
    inputImageUrl,
    isHydrated,
    pool,
    poolId,
    pools,
    retryKey,
    savedRecord,
    savedRecordAccountId,
    savedTestId,
    session.analysisResult,
    session.confirmedImageUri,
    session.dosageResult,
    session.imagePath,
    session.imageUri,
    session.imageUrl,
    session.qualityNotes,
    session.imageQuality,
    session.captureMetadata,
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

  const resultCards = useMemo(
    () => (visibleAnalysisResult ? getResultCards(visibleAnalysisResult) : []),
    [visibleAnalysisResult],
  );
  const padColors = usePadPhotoColors(visibleAnalysisResult);
  const totalChlorineReading = visibleAnalysisResult?.parameters.find(parameter => parameter.key === 'totalChlorine');
  const totalChlorineDisplay = totalChlorinePresentation(totalChlorineReading);
  const showTotalChlorine = visibleAnalysisResult?.brandId === 'aquachek-pro-5in1' || Boolean(totalChlorineReading);
  const chlorineReview = getChlorineReview(visibleAnalysisResult?.parameters ?? []);
  const graphReadings: ParameterArcReading[] = visibleAnalysisResult ? [
    ...(showTotalChlorine ? [{
      paramKey: 'totalChlorine' as const,
      labelHe: PARAM_LABEL_HE.totalChlorine.labelHe,
      measured: totalChlorineDisplay?.value,
      usesUpperCandidate: totalChlorineDisplay?.usesUpperCandidate,
      unit: totalChlorineReading?.unit || 'ppm',
      estimated: true,
      status: totalChlorineDisplay?.kind,
      target: totalChlorineReading && comparisonKind(totalChlorineReading) !== undefined
        ? targetForParameter(totalChlorineReading) : undefined,
      comparisonRange: totalChlorineReading?.idealRange,
      requiresReview: Boolean(chlorineReview) || Boolean(totalChlorineReading && readingNeedsClarification(totalChlorineReading)),
      reviewLabel: chlorineReview?.reason === 'gap' ? 'חשד לכלור קשור'
        : chlorineReview?.reason === 'inconsistent' ? 'קריאות סותרות' : 'קריאה בין טווחים',
    }] : []),
    ...(['ph', 'alkalinity'] as const).map(paramKey => {
      const parameter = visibleAnalysisResult.parameters.find(item => item.key === paramKey);
      return {
        paramKey, labelHe: paramKey === 'ph' ? 'חומציות (pH)' : PARAM_LABEL_HE.alkalinity.labelHe,
        measured: parameter?.value, unit: parameter?.unit ?? (paramKey === 'ph' ? '' : 'ppm'),
        estimated: true,
        status: parameter ? comparisonKind(parameter) : undefined,
        target: parameter && comparisonKind(parameter) !== undefined ? targetForParameter(parameter) : undefined,
        comparisonRange: parameter?.idealRange,
        requiresReview: Boolean(parameter && readingNeedsClarification(parameter)),
      };
    }),
  ] : [];

  useEffect(() => {
    if (savedTestId || !visibleAnalysisResult || isInvalidStripResult(visibleAnalysisResult))
      return;
    if (autoSavedTestIdRef.current === visibleAnalysisResult.id) return;
    if (autoSavedResultIds.has(visibleAnalysisResult.id)) {
      setAutoSaved(true);
      return;
    }

    autoSavedTestIdRef.current = visibleAnalysisResult.id;
    autoSavedResultIds.add(visibleAnalysisResult.id);
    saveAnalysisResult(visibleAnalysisResult);
    setAutoSaved(true);
  }, [saveAnalysisResult, savedTestId, visibleAnalysisResult]);

  function handleNewScan() {
    resetScanSession();
    startScanFlow(poolId);
  }

  function chooseAnotherStrip() {
    startScanSession({ poolId });
    navigation.navigate('SelectStrip', poolId ? { poolId } : undefined);
  }

  if (!savedTestId && !inputImageUri && !visibleAnalysisResult) {
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
          <PrimaryButton
            label="חזרה לסריקה"
            icon="scan"
            onPress={() => navigation.replace('Scan')}
          />
        </View>
      </AppShell>
    );
  }

  if (analysisError && !visibleAnalysisResult) {
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
          <PrimaryButton
            label="נסה שוב"
            icon="scan"
            onPress={() => setRetryKey((current) => current + 1)}
          />
          <Pressable style={styles.secondaryButton} onPress={handleNewScan}>
            <LineIcon name="camera" color={colors.primaryDark} size={16} />
            <Text style={styles.secondaryText}>חזרה לסריקה</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  if (isAnalyzing || !isHydrated) {
    return (
      <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>
            {isSavedResult ? 'טוען בדיקה שמורה...' : 'מנתח את תמונת הסטיק...'}
          </Text>
        </View>
        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <ActivityIndicator color={colors.primaryDark} size="small" />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.messageTitle}>
              {isSavedResult ? 'פותח בדיקה מההיסטוריה' : 'ניתוח בדיקה בפעולה'}
            </Text>
            <Text style={styles.messageText}>
              {isSavedResult
                ? 'אנחנו טוענים את פרטי הבדיקה השמורה מהענן.'
                : 'אנחנו מנתחים את תמונת הסטיק ומכינים את תוצאות הבדיקה.'}
            </Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  if (visibleAnalysisResult && isInvalidStripResult(visibleAnalysisResult)) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>הקריאה לא הושלמה</Text>
        </View>
        <Card compact style={styles.messageCard}>
          <Text style={styles.messageTitle}>{invalidStripTitle(visibleAnalysisResult)}</Text>
          <Text style={styles.messageText}>{invalidStripMessage(visibleAnalysisResult)}</Text>
        </Card>
        <View style={styles.actions}>
          <PrimaryButton label="צלם שוב" icon="camera" onPress={handleNewScan} />
          {(!visibleAnalysisResult.failureReason || ['not_strip', 'unsupported_strip'].includes(visibleAnalysisResult.failureReason)) ? <Pressable style={styles.secondaryButton} onPress={chooseAnotherStrip}>
            <LineIcon name="scan" color={colors.primaryDark} size={16} />
            <Text style={styles.secondaryText}>בחר סטיק אחר</Text>
          </Pressable> : null}
        </View>
      </AppShell>
    );
  }

  if (savedTestId && !visibleAnalysisResult) {
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

  if (!visibleAnalysisResult) {
    return (
      <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation}>
        <View style={styles.emptyHeader}>
          <Text style={styles.title}>תוצאות הבדיקה</Text>
          <Text style={styles.subtitle}>טוען תוצאות...</Text>
        </View>
        <Card compact style={styles.analyzingCard}>
          <View style={styles.analyzingIcon}>
            <ActivityIndicator color={colors.primaryDark} size="small" />
          </View>
          <View style={styles.analyzingCopy}>
            <Text style={styles.messageTitle}>מכינים את התוצאה</Text>
            <Text style={styles.messageText}>אנחנו טוענים את פרטי הבדיקה.</Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab={isSavedResult ? 'history' : 'scan'} navigation={navigation} waterMode="plain">
      <ResultOverview result={visibleAnalysisResult} poolName={poolName} isHistorical={isSavedResult}
        metadata={formatAnalysisDate(visibleAnalysisResult.analyzedAt)} readings={graphReadings} volumeLiters={pool?.volumeLiters} />

      {visibleAnalysisResult.lowConfidence ? <LowConfidenceWarning /> : null}

      <NextActionCard
        key={savedRecord?.testId ?? visibleAnalysisResult.id}
        result={visibleAnalysisResult}
        testId={savedRecord?.testId}
        pool={pool}
        allowRecord={!isSavedResult}
        isHistorical={isSavedResult}
        onNewScan={handleNewScan}
        onEditPool={() => pool && navigation.navigate('EditPool', { poolId: pool.id })}
      />

      <View style={styles.section}>
        <DisclosureSection title="פירוט הבדיקה" variant="quiet">
          <Text style={styles.sectionCaption}>הריבועים לפי הסדר, מקצה הסטיק לכיוון הידית</Text>
          {showTotalChlorine ? (
            <TotalChlorineReadingCard parameter={totalChlorineReading} chlorineReview={chlorineReview}
              padPosition={visibleAnalysisResult.brandId === 'aquachek-pro-5in1' ? 1 : undefined}
              padColor={padColors.totalChlorine} />
          ) : null}
          {resultCards.map((rec) => (
            <ResultCard key={rec.paramKey} rec={rec} compact showPadColor
              padPosition={visibleAnalysisResult.brandId === 'aquachek-pro-5in1' ? PRO_PAD_POSITION[rec.paramKey] : undefined}
              padColor={padColors[rec.paramKey]} />
          ))}

          {!isInvalidStripResult(visibleAnalysisResult) && visibleAnalysisResult.dosage?.recommendations.some(
            (rec) => !CORE_RESULT_PARAMETER_KEYS.has(rec.paramKey),
          ) ? <>
            <Text style={styles.sectionTitle}>מדדים נוספים</Text>
            {visibleAnalysisResult.dosage.recommendations.filter((rec) => !CORE_RESULT_PARAMETER_KEYS.has(rec.paramKey))
              .map((rec) => <ResultCard key={rec.paramKey} rec={rec} compact showPadColor
                padColor={padColors[rec.paramKey]} />)}
          </> : null}

          <DisclosureSection title="הסברים ומידע חשוב">
            {visibleAnalysisResult.dosage?.primaryRecommendation?.guidance ?
              <Text style={styles.explanationText}>{visibleAnalysisResult.dosage.primaryRecommendation.guidance.meaning}</Text> : null}
            <Text style={styles.explanationText}>הריבוע הצבעוני מציג את צבע הסטיק. צבע תגית המצב מסביר אם הקריאה בטווח, גבוהה או נמוכה.</Text>
            <Text style={styles.explanationText}>כ־ פירושו שהמספר הוא הערכה מהצילום. ppm היא יחידת ריכוז של חומר במים. הטווח המוצג הוא טווח ההשוואה של האפליקציה, ולא מינון להוספה.</Text>
            <Text style={styles.explanationText}>{visibleAnalysisResult.dosage?.safetyNote || MEASUREMENT_SAFETY_NOTE}</Text>
            <GuidanceSources />
          </DisclosureSection>
          {session.imageUploadError && !isSavedResult ? (
            <View>
              <Text style={styles.warningTitle}>התמונה נשמרה מקומית</Text>
              <Text style={styles.warningText}>{session.imageUploadError}</Text>
            </View>
          ) : null}
        </DisclosureSection>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" style={styles.historyLink}
          onPress={() => navigation.navigate('History')}>
          <LineIcon name={!isSavedResult && autoSaved ? 'check' : 'history'} color={colors.primaryDeep} size={15} />
          <Text style={styles.savedText} accessibilityLiveRegion="polite">{isSavedResult
            ? 'חזרה להיסטוריה' : autoSaved ? 'נשמר בהיסטוריה · פתיחה' : 'שומר להיסטוריה…'}</Text>
        </Pressable>
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
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    marginBottom: 3,
    ...rtl.text,
  },
  sectionCaption: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, marginBottom: 4, ...rtl.text },
  explanationText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 13, lineHeight: 22, ...rtl.text },
  historyLink: { ...rtl.row, alignItems: 'center', justifyContent: 'center', minHeight: 44, gap: 5 },
  savedText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    ...rtl.text,
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
