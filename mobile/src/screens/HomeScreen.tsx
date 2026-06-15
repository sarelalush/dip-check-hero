import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { MetricCard } from '../components/MetricCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { PoolPhoto } from '../components/WaterVisuals';
import { colors, rtl, typography } from '../theme';
import type { ScanResultParameter } from '../domain/scanResults';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

function formatMetricValue(parameter?: ScanResultParameter) {
  if (!parameter) return '-';
  return parameter.key === 'ph' ? parameter.value.toFixed(1) : Math.round(parameter.value).toLocaleString('he-IL');
}

function metricFromResult(parameters: ScanResultParameter[], keys: ScanResultParameter['key'][], fallbackLabel: string) {
  const parameter = parameters.find((item) => keys.includes(item.key));
  return {
    label: parameter?.name ?? fallbackLabel,
    status: parameter?.status.label ?? 'אין נתון',
    tone: parameter?.status.tone ?? ('warning' as const),
    value: formatMetricValue(parameter),
  };
}

export function HomeScreen({ navigation }: Props) {
  const { pools } = usePools();
  const { historyRecords } = useResultsHistory();
  const hasPools = pools.length > 0;
  const latestRecord = useMemo(
    () => [...historyRecords].sort((a, b) => b.testedAt - a.testedAt)[0],
    [historyRecords],
  );
  const latestResult = latestRecord?.analysisResult;
  const latestMetrics = latestResult
    ? [
        metricFromResult(latestResult.parameters, ['ph'], 'pH'),
        metricFromResult(latestResult.parameters, ['freeChlorine', 'totalChlorine'], 'כלור'),
        metricFromResult(latestResult.parameters, ['alkalinity'], 'אלקליניות'),
      ]
    : [];
  const latestTone = latestRecord?.tone ?? latestResult?.overallStatus.tone ?? 'warning';

  if (!hasPools) {
    return (
      <AppShell activeTab="home" navigation={navigation}>
        <AppHeader />

        <View style={styles.greeting}>
          <Text style={styles.hello}>ברוכים הבאים ל־AquaSense</Text>
          <Text style={styles.subtitle}>כדי להתחיל, הוסף את הבריכה הראשונה שלך</Text>
        </View>

        <View style={styles.hero}>
          <PoolPhoto variant="home" />
        </View>

        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <LineIcon name="pools" color={colors.primaryDark} size={28} />
          </View>
          <Text style={styles.statusTitle}>הבריכה שלך מתחילה כאן</Text>
          <Text style={styles.emptyText}>לאחר מכן תוכל לצלם סטיק ולקבל המלצה מותאמת לפי נפח וסוג הבריכה.</Text>
        </Card>

        <View style={styles.ctaWrap}>
          <PrimaryButton label="הוסף בריכה" icon="plus" onPress={() => navigation.navigate('AddPool')} />
        </View>
      </AppShell>
    );
  }

  return (
    <AppShell activeTab="home" navigation={navigation}>
      <AppHeader />

      <View style={styles.greeting}>
        <Text style={styles.hello}>שלום!</Text>
        <Text style={styles.subtitle}>כיף לראות אותך שוב</Text>
      </View>

      <View style={styles.hero}>
        <PoolPhoto variant="home" />
      </View>

      {latestRecord && latestResult ? (
        <Card style={styles.statusCard}>
          <Text style={styles.cardKicker}>מצב המים</Text>
          <View style={[styles.checkCircle, latestTone === 'success' ? styles.checkCircleOk : styles.checkCircleWarning]}>
            <LineIcon name={latestTone === 'success' ? 'check' : 'help'} color={latestTone === 'success' ? colors.success : colors.warning} size={32} />
          </View>
          <Text style={styles.statusTitle}>{latestRecord.status}</Text>
          <Text style={styles.statusSubtitle}>{latestRecord.poolName} · {latestRecord.date}</Text>

          <View style={styles.metrics}>
            {latestMetrics.map((metric) => (
              <MetricCard key={metric.label} label={metric.label} status={metric.status} tone={metric.tone} value={metric.value} />
            ))}
          </View>
        </Card>
      ) : (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <LineIcon name="scan" color={colors.primaryDark} size={28} />
          </View>
          <Text style={styles.statusTitle}>עדיין אין בדיקה אחרונה</Text>
          <Text style={styles.emptyText}>בצע סריקה ראשונה כדי שמצב המים במסך הבית יתעדכן לפי התוצאה האמיתית האחרונה.</Text>
        </Card>
      )}

      <View style={styles.ctaWrap}>
        <PrimaryButton label="התחל סריקה" icon="scan" onPress={() => navigation.navigate('SelectStrip')} />
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  greeting: {
    marginTop: 10,
    alignItems: 'center',
  },
  hello: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 5,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  hero: {
    marginHorizontal: -20,
    marginTop: 16,
    height: 230,
    borderRadius: 0,
    backgroundColor: colors.water,
    overflow: 'hidden',
  },
  statusCard: {
    width: '79%',
    alignSelf: 'center',
    marginTop: -132,
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 16,
    borderRadius: 20,
  },
  emptyCard: {
    width: '84%',
    alignSelf: 'center',
    marginTop: -112,
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderRadius: 20,
  },
  emptyIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  cardKicker: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  checkCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleOk: {
    backgroundColor: '#CFF6D6',
    borderColor: '#9EE8AD',
  },
  checkCircleWarning: {
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(240,165,41,0.35)',
  },
  statusTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 19,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  statusSubtitle: {
    marginTop: -7,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.textCenter,
  },
  metrics: {
    width: '100%',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  ctaWrap: {
    marginTop: 16,
  },
});
