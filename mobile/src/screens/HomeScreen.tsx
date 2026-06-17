import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
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
  return parameter.key === 'ph' ? parameter.value.toFixed(1) : Math.round(parameter.value).toLocaleString('he-IL');
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
    tone: parameter?.status.tone ?? 'warning',
    value: formatMetricValue(parameter),
  };
}

function scoreForTone(tone: StatusTone) {
  if (tone === 'success') return 92;
  if (tone === 'danger') return 48;
  if (tone === 'neutral') return 82;
  return 72;
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
  const { historyRecords } = useResultsHistory();
  const startScanFlow = useStartScanFlow(navigation);
  const latestRecord = useMemo(
    () => [...historyRecords].sort((a, b) => b.testedAt - a.testedAt)[0],
    [historyRecords],
  );
  const latestResult = latestRecord?.analysisResult;
  const latestTone = latestRecord?.tone ?? latestResult?.overallStatus.tone ?? 'warning';
  const score = latestResult ? scoreForTone(latestTone) : 0;
  const primaryStatus = latestRecord?.status ?? (pools.length > 0 ? 'מוכן לבדיקה ראשונה' : 'הוסף בריכה ראשונה');
  const metrics = latestResult
    ? [
        metricFromResult(latestResult.parameters, ['ph'], 'pH', 'drop'),
        metricFromResult(latestResult.parameters, ['freeChlorine', 'totalChlorine'], 'כלור פעיל', 'help'),
        metricFromResult(latestResult.parameters, ['alkalinity'], 'אלקליניות', 'results'),
      ]
    : [
        { icon: 'drop' as const, label: 'pH', status: 'אין נתון', tone: 'neutral' as const, value: '-' },
        { icon: 'help' as const, label: 'כלור פעיל', status: 'אין נתון', tone: 'neutral' as const, value: '-' },
        { icon: 'results' as const, label: 'אלקליניות', status: 'אין נתון', tone: 'neutral' as const, value: '-' },
      ];

  return (
    <AppShell activeTab="home" navigation={navigation} scroll={false} contentStyle={styles.screen}>
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
        <View style={styles.cardKickerRow}>
          <LineIcon name="drop" color={colors.primary} size={18} />
          <Text style={styles.cardKicker}>מצב המים</Text>
        </View>

        <View style={styles.statusTop}>
          <ScoreRing score={score} tone={latestTone} />
          <View style={styles.statusCopy}>
            <Text style={[styles.statusTitle, { color: latestResult ? colorForTone(latestTone) : colors.text }]}>
              {primaryStatus}
            </Text>
            <Text style={styles.statusSubtitle}>{formatLastTest(latestRecord)}</Text>
          </View>
        </View>

        <View style={styles.metrics}>
          {metrics.map((metric) => (
            <MetricTile key={metric.label} metric={metric} />
          ))}
        </View>
      </Card>

      <View style={styles.ctaWrap}>
        <PrimaryButton label={pools.length > 0 ? 'התחל סריקה' : 'הוסף בריכה'} icon={pools.length > 0 ? 'scan' : 'plus'} onPress={() => (pools.length > 0 ? startScanFlow() : navigation.navigate('AddPool'))} />
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

function ScoreRing({ score, tone }: { score: number; tone: StatusTone }) {
  const size = 82;
  const stroke = 7;
  const radiusValue = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const progress = Math.max(0, Math.min(100, score));
  const dashOffset = circumference - (circumference * progress) / 100;
  const color = colorForTone(tone);

  return (
    <View style={styles.scoreWrap}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle cx={size / 2} cy={size / 2} r={radiusValue} stroke="#F4E6D0" strokeWidth={stroke} fill="#FFF8EA" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radiusValue}
          stroke={color}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.scoreCenter}>
        <Text style={styles.scoreValue}>{score || '-'}</Text>
        <Text style={styles.scoreLabel}>מכל 100</Text>
      </View>
    </View>
  );
}

function MetricTile({ metric }: { metric: HomeMetric }) {
  return (
    <View style={styles.metricCard}>
      <LineIcon name={metric.icon} color={colors.primaryDark} size={22} />
      <Text style={styles.metricLabel}>{metric.label}</Text>
      <Text style={styles.metricValue}>{metric.value}</Text>
      <Text style={[styles.metricStatus, { color: colorForTone(metric.tone) }]}>{metric.status}</Text>
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
    <Pressable onPress={onPress} style={({ pressed }) => [styles.shortcutCard, pressed && styles.pressed]}>
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
  scoreWrap: {
    alignItems: 'center',
    height: 82,
    justifyContent: 'center',
    width: 82,
  },
  scoreCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  scoreValue: {
    color: colors.text,
    fontFamily: typography.fontFamilyExtraBold,
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  scoreLabel: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '700',
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
