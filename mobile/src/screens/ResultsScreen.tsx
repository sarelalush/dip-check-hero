import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { PrimaryButton } from '../components/PrimaryButton';
import { ResultRow } from '../components/ResultRow';
import { LineIcon } from '../components/LineIcon';
import { colors, rtl, typography } from '../theme';
import type { StripAnalysisResult } from '../domain/scanResults';
import { analyzeStripImageMock } from '../services/mockAnalysisService';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';
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

export function ResultsScreen({ navigation, route }: Props) {
  const { saveAnalysisResult } = useResultsHistory();
  const { getPool } = usePools();
  const [analysisResult, setAnalysisResult] = useState<StripAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const pool = route.params?.poolId ? getPool(route.params.poolId) : undefined;
  const poolName = pool?.name ?? FALLBACK_POOL_NAME;
  const hasImage = Boolean(route.params?.imageUri);

  useEffect(() => {
    let isMounted = true;

    async function analyzeImage() {
      setIsAnalyzing(true);
      const result = await analyzeStripImageMock({
        brandId: route.params?.brandId,
        imageUri: route.params?.imageUri,
        poolId: route.params?.poolId,
      });

      if (isMounted) {
        setAnalysisResult(result);
        setIsAnalyzing(false);
      }
    }

    analyzeImage();

    return () => {
      isMounted = false;
    };
  }, [route.params?.brandId, route.params?.imageUri, route.params?.poolId]);

  function handleSave() {
    if (!analysisResult) {
      return;
    }

    saveAnalysisResult(analysisResult);
    navigation.navigate('History');
  }

  if (isAnalyzing || !analysisResult) {
    return (
      <AppShell activeTab="scan" navigation={navigation}>
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
            <Text style={styles.analyzingTitle}>ניתוח mock בפעולה</Text>
            <Text style={styles.analyzingText}>אנחנו מכינים מבנה תוצאה מלא, הערכים עדיין דוגמתיים.</Text>
          </View>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>תוצאות הבדיקה</Text>
        <Text style={styles.poolName}>{poolName}</Text>
        <Text style={styles.subtitle}>{formatAnalysisDate(analysisResult.analyzedAt)}</Text>
      </View>

      <View style={styles.resultsList}>
        {hasImage ? (
          <View style={styles.imageReceived}>
            <View style={styles.imageReceivedIcon}>
              <LineIcon name="image" color={colors.primaryDark} size={15} />
            </View>
            <Text style={styles.imageReceivedText}>תמונת הסטיק התקבלה - מוצגות תוצאות mock</Text>
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
        </View>
      </Card>

      <View style={styles.saveButton}>
        <PrimaryButton label="סיום ושמירה" icon="history" onPress={handleSave} />
      </View>
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
  saveButton: {
    marginTop: 16,
  },
});
