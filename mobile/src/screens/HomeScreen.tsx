import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppHeader } from '../components/AppHeader';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon, type LineIconName } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { ScanResultParameter } from '../domain/scanResults';
import type { StatusTone } from '../components/StatusBadge';
import { useStartScanFlow } from '../hooks/useStartScanFlow';
import { usePools } from '../state/PoolsContext';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import type { RootStackParamList } from '../../App';
import { PoolPicker } from '../components/PoolPicker';
import { formatReading, nextAction, resultStatus } from '../domain/resultPresentation';
import { useTreatments } from '../state/TreatmentContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

interface HomeMetric {
  icon: LineIconName;
  label: string;
  status: string;
  tone: StatusTone;
  value: string;
}

function formatMetricValue(parameter?: ScanResultParameter) {
  if (!parameter) return '-';
  return formatReading(parameter);
}

function metricFromResult(
  parameters: ScanResultParameter[],
  keys: ScanResultParameter['key'][],
  fallbackLabel: string,
  icon: LineIconName,
): HomeMetric {
  const parameter = parameters.find((item) => keys.includes(item.key));
  return {
    icon,
    label: parameter?.name ?? fallbackLabel,
    status: parameter?.status.label ?? 'אין נתון',
    tone: parameter?.status.tone ?? 'neutral',
    value: formatMetricValue(parameter),
  };
}

function colorForTone(tone: StatusTone) {
  if (tone === 'success') return colors.success;
  if (tone === 'danger') return colors.danger;
  if (tone === 'neutral') return colors.primary;
  return '#F78A12';
}

function formatLastTest(record?: { date?: string }) {
  return record?.date ? `בדיקה אחרונה: ${record.date}` : 'עדיין אין בדיקה אחרונה';
}

export function HomeScreen({ navigation }: Props) {
  const { pools } = usePools();
  const { getPoolHistoryRecords } = useResultsHistory();
  const startScanFlow = useStartScanFlow(navigation);
  const [scanOpening, setScanOpening] = useState(false);
  const [selectedPoolId, setSelectedPoolId] = useState<string>();
  const selectedPool = pools.find((pool) => pool.id === selectedPoolId) ?? pools[0];
  const latestRecord = selectedPool ? getPoolHistoryRecords(selectedPool.id, 1)[0] : undefined;
  const latestResult = latestRecord?.analysisResult;
  const { getTreatment } = useTreatments();
  const treatment = latestRecord ? getTreatment(latestRecord.testId) : undefined;
  const status = resultStatus(latestResult);
  const latestTone = status.tone;
  const primaryStatus = latestRecord && !latestResult ? 'בדיקה שמורה — פתח לפירוט' : status.label;
  const metrics =
    latestResult && status.label !== 'נדרש צילום חוזר'
      ? [
          metricFromResult(latestResult.parameters, ['ph'], 'pH', 'drop'),
          metricFromResult(latestResult.parameters, ['freeChlorine'], 'כלור חופשי', 'help'),
          metricFromResult(latestResult.parameters, ['alkalinity'], 'אלקליניות', 'results'),
        ]
      : [];

  function handlePrimaryAction() {
    if (pools.length === 0) {
      navigation.navigate('AddPool');
      return;
    }

    if (scanOpening) return;
    setScanOpening(true);
    requestAnimationFrame(() => {
      startScanFlow(selectedPool?.id);
      setTimeout(() => setScanOpening(false), 1200);
    });
  }

  return (
    <AppShell activeTab="home" navigation={navigation} contentStyle={styles.screen}>
      <AppHeader />

      <View style={styles.hero}>
        <View style={styles.greeting}>
          <Text style={styles.hello}>{pools.length > 0 ? 'שלום!' : 'ברוכים הבאים'}</Text>
          <Text style={styles.subtitle}>
            {pools.length > 0 ? 'כיף לראות אותך שוב' : 'כדי להתחיל, הוסף את הבריכה הראשונה שלך'}
          </Text>
        </View>
      </View>

      <Card style={styles.statusCard}>
        {pools.length > 1 ? (
          <PoolPicker pools={pools} selectedId={selectedPool?.id} onSelect={setSelectedPoolId} />
        ) : null}
        <View style={styles.cardKickerRow}>
          <LineIcon name="drop" color={colors.primary} size={18} />
          <Text style={styles.cardKicker}>
            {selectedPool?.name ?? 'הבריכה שלך'} · הבדיקה האחרונה
          </Text>
        </View>

        <View style={styles.statusTop}>
          <View style={styles.statusIcon}>
            <LineIcon
              name={latestTone === 'success' ? 'check' : latestTone === 'warning' ? 'help' : 'drop'}
              color={colorForTone(latestTone)}
              size={32}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text
              style={[
                styles.statusTitle,
                { color: latestResult ? colorForTone(latestTone) : colors.text },
              ]}
            >
              {primaryStatus}
            </Text>
            <Text style={styles.statusSubtitle}>{formatLastTest(latestRecord)}</Text>
          </View>
        </View>

        {metrics.length ? (
          <View style={styles.metrics}>
            {metrics.map((metric) => (
              <MetricTile key={metric.label} metric={metric} />
            ))}
          </View>
        ) : null}
        <View style={styles.nextStep}>
          <Text style={styles.nextStepTitle}>הצעד הבא</Text>
          <Text style={styles.nextStepText}>
            {treatment
              ? treatment.retestAt
                ? treatment.retestAt <= Date.now()
                  ? 'פעולה תועדה והגיע הזמן לבדיקה חוזרת. בצע סריקה חדשה כדי לראות את השינוי.'
                  : `פעולה תועדה. בדיקה חוזרת מתוכננת ל־${new Date(treatment.retestAt).toLocaleString('he-IL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}.`
                : 'פעולה תועדה. פתח את התוצאה להגדרת תזכורת לבדיקה חוזרת.'
              : nextAction(latestResult)}
          </Text>
          {latestRecord ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('Results', { testId: latestRecord.testId })}
              style={styles.resultLink}
            >
              <Text style={styles.nextStepTitle}>פתח תוצאה והמלצה</Text>
            </Pressable>
          ) : null}
        </View>
      </Card>

      <View style={styles.ctaWrap}>
        <PrimaryButton
          busy={scanOpening}
          label={scanOpening ? 'פותח סריקה...' : pools.length > 0 ? 'התחל סריקה' : 'הוסף בריכה'}
          icon={pools.length > 0 ? 'scan' : 'plus'}
          onPress={handlePrimaryAction}
        />
      </View>

      <View style={styles.shortcuts}>
        <ShortcutCard
          icon="pools"
          title="הבריכה שלי"
          subtitle="צפייה בפרטי הבריכה ותוכניות"
          onPress={() => navigation.navigate('Pools')}
        />
        <ShortcutCard
          icon="history"
          title="היסטוריית בדיקות"
          subtitle="צפייה בבדיקות קודמות ותוצאות"
          onPress={() => navigation.navigate('History')}
        />
      </View>
    </AppShell>
  );
}

function MetricTile({ metric }: { metric: HomeMetric }) {
  return (
    <View style={styles.metricCard}>
      <LineIcon name={metric.icon} color={colors.primaryDark} size={22} />
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{metric.value}</Text>
      <Text style={[styles.metricStatus, { color: colorForTone(metric.tone) }]}>
        {metric.status}
      </Text>
    </View>
  );
}

function ShortcutCard({
  icon,
  onPress,
  subtitle,
  title,
}: {
  icon: LineIconName;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}
    >
      <View style={styles.shortcutIcon}>
        <LineIcon name={icon} color={colors.primaryDark} size={24} />
      </View>
      <View style={styles.shortcutCopy}>
        <Text style={styles.shortcutTitle}>{title}</Text>
        <Text style={styles.shortcutSubtitle}>{subtitle}</Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.textSoft} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  statusIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStep: {
    marginTop: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: colors.backgroundDeep,
    gap: 6,
  },
  nextStepTitle: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    color: colors.primaryDeep,
    ...rtl.text,
  },
  nextStepText: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    lineHeight: 21,
    color: colors.text,
    ...rtl.text,
  },
  resultLink: { paddingVertical: 10, minHeight: 44 },
  screen: {
    paddingHorizontal: 18,
    paddingBottom: 82,
  },
  hero: {
    height: 228,
    marginHorizontal: -18,
    marginTop: -8,
    overflow: 'hidden',
  },
  greeting: {
    alignItems: 'flex-end',
    position: 'absolute',
    right: 26,
    top: 16,
  },
  hello: {
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
    ...rtl.text,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
    ...rtl.text,
  },
  statusCard: {
    alignSelf: 'center',
    borderRadius: 26,
    marginTop: -60,
    paddingBottom: 16,
    paddingHorizontal: 14,
    paddingTop: 16,
    width: '100%',
  },
  cardKickerRow: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
    justifyContent: 'center',
  },
  cardKicker: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  statusTop: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 18,
    justifyContent: 'space-between',
    marginTop: 10,
  },
  statusCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  statusTitle: {
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
    ...rtl.text,
  },
  statusSubtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 3,
    ...rtl.text,
  },
  metrics: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 16,
  },
  metricCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 104,
    paddingHorizontal: 7,
    paddingVertical: 10,
    ...shadows.soft,
  },
  metricLabel: {
    color: colors.text,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
    ...rtl.textCenter,
  },
  metricValue: {
    color: '#0F9F8E',
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 34,
    marginTop: 3,
    ...rtl.textCenter,
  },
  metricStatus: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    marginTop: 3,
    ...rtl.textCenter,
  },
  ctaWrap: {
    marginTop: 12,
  },
  shortcuts: {
    flexDirection: 'row-reverse',
    gap: 12,
    marginTop: 12,
    paddingBottom: 0,
  },
  shortcutCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row-reverse',
    gap: 8,
    minHeight: 74,
    paddingHorizontal: 10,
    paddingVertical: 10,
    ...shadows.soft,
  },
  shortcutIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  shortcutCopy: {
    alignItems: 'flex-end',
    flex: 1,
  },
  shortcutTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  shortcutSubtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 2,
    ...rtl.text,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
