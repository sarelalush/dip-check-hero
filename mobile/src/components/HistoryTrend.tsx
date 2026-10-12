import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { SavedHistoryRecord } from '../state/ResultsHistoryContext';
import type { ScanParameterKey } from '../domain/scanResults';
import { resultStatus } from '../domain/resultPresentation';
import { colors, rtl, typography } from '../theme';
import { DisclosureSection } from './DisclosureSection';

const METRICS: Array<{ key: ScanParameterKey; label: string }> = [
  { key: 'ph', label: 'pH' },
  { key: 'freeChlorine', label: 'כלור חופשי' },
  { key: 'alkalinity', label: 'אלקליניות' },
];
export function HistoryTrend({
  records,
  onOpen,
}: {
  records: SavedHistoryRecord[];
  onOpen: (testId: string) => void;
}) {
  const [key, setKey] = useState<ScanParameterKey>('ph');
  const points = useMemo(
    () =>
      records
        .filter(
          (record) =>
            record.analysisResult &&
            resultStatus(record.analysisResult).label !== 'נדרש צילום חוזר',
        )
        .map((record) => ({
          record,
          reading: record.analysisResult?.parameters.find((parameter) => parameter.key === key),
        }))
        .filter((point) => point.reading && Number.isFinite(point.reading.value))
        .sort((a, b) => a.record.testedAt - b.record.testedAt)
        .slice(-20),
    [key, records],
  );
  const range = points[points.length - 1]?.reading?.idealRange;
  const values = points.map((point) => point.reading!.value);
  const min = Math.min(...values, range?.min ?? 0);
  const max = Math.max(...values, range?.max ?? 1);
  const padding = Math.max((max - min) * 0.15, key === 'ph' ? 0.2 : 1);
  const low = Math.max(0, min - padding);
  const high = max + padding;
  const first = points[0]?.record.testedAt ?? 0;
  const last = points[points.length - 1]?.record.testedAt ?? 1;
  const xFor = (at: number) =>
    points.length === 1 || last === first ? 160 : 20 + ((at - first) / (last - first)) * 280;
  const yFor = (value: number) => 125 - ((value - low) / (high - low)) * 105;
  const coordinates = points
    .map((point) => `${xFor(point.record.testedAt)},${yFor(point.reading!.value)}`)
    .join(' ');
  const date = (at: number) =>
    new Date(at).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  const latestReading = points[points.length - 1]?.reading;
  const metricLabel = METRICS.find((metric) => metric.key === key)?.label;
  const latestValue = latestReading
    ? `\u2066${latestReading.value}${latestReading.unit ? ` ${latestReading.unit}` : ''}\u2069`
    : '';
  return (
    <View style={styles.wrap}>
      <DisclosureSection
        title="מגמת המדדים"
        summary={
          points.length
            ? `${key === 'ph' ? '\u2066pH\u2069' : metricLabel}: ${latestValue} · ${points.length} בדיקות`
            : 'אין מדידות בטווח שנבחר'
        }
      >
        <View style={styles.tabs}>
          {METRICS.map((metric) => (
            <Pressable
              key={metric.key}
              accessibilityRole="button"
              accessibilityState={{ selected: key === metric.key }}
              onPress={() => setKey(metric.key)}
              style={[styles.tab, key === metric.key && styles.selected]}
            >
              <Text style={[styles.tabText, key === metric.key && styles.selectedText]}>
                {metric.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {points.length ? (
          <>
            <View
              accessible
              accessibilityLabel={points
                .map(
                  (point) =>
                    `${date(point.record.testedAt)}: ${point.reading!.value} ${point.reading!.unit}`,
                )
                .join('; ')}
            >
              <Svg width="100%" height={155} viewBox="0 0 320 150">
                {range ? (
                  <Rect
                    x={20}
                    y={yFor(range.max)}
                    width={280}
                    height={Math.max(0, yFor(range.min) - yFor(range.max))}
                    fill={colors.successSoft}
                  />
                ) : null}
                <Line x1={20} y1={125} x2={300} y2={125} stroke={colors.borderStrong} />
                {points.length > 1 ? (
                  <Polyline
                    points={coordinates}
                    fill="none"
                    stroke={colors.primaryDeep}
                    strokeWidth={2.5}
                  />
                ) : null}
                {points.map((point) => (
                  <Circle
                    key={point.record.testId}
                    cx={xFor(point.record.testedAt)}
                    cy={yFor(point.reading!.value)}
                    r={5}
                    fill={point.reading!.status.kind === 'ok' ? colors.success : colors.warning}
                    onPress={() => onOpen(point.record.testId)}
                  />
                ))}
                <SvgText x={18} y={15} fontSize={11} fill={colors.textSoft}>
                  {high.toFixed(key === 'ph' ? 1 : 0)}
                </SvgText>
                <SvgText x={18} y={145} fontSize={11} fill={colors.textSoft}>
                  {low.toFixed(key === 'ph' ? 1 : 0)}
                </SvgText>
              </Svg>
            </View>
            <View style={styles.axis}>
              <Text style={styles.note}>{date(first)}</Text>
              <Text style={styles.note}>{date(last)}</Text>
            </View>
            <Text style={styles.note}>
              האזור הירוק הוא הטווח הרצוי במדד זה
              {range
                ? ` (\u2066${range.min}–${range.max}${latestReading?.unit ? ` ${latestReading.unit}` : ''}\u2069)`
                : ''}
              . הנקודות הן בדיקות בפועל; הקו מסייע לראות מגמה.
            </Text>
            <Text style={styles.latest}>
              אחרון: {latestValue} · {points.length} בדיקות
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onOpen(points[points.length - 1].record.testId)}
              style={styles.open}
            >
              <Text style={styles.link}>פתח את הבדיקה האחרונה</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.note}>
            לא נמצאו מדידות מפורטות בטווח שנבחר. לאחר בדיקה תופיע כאן המגמה.
          </Text>
        )}
      </DisclosureSection>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  tabs: { flexDirection: 'row-reverse', gap: 6 },
  tab: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.backgroundDeep,
    borderRadius: 16,
  },
  selected: { backgroundColor: colors.primaryDeep },
  tabText: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    color: colors.text,
    ...rtl.textCenter,
  },
  selectedText: { color: colors.white },
  axis: { flexDirection: 'row', justifyContent: 'space-between' },
  note: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSoft,
    ...rtl.text,
  },
  latest: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.text,
    ...rtl.text,
  },
  open: { minHeight: 44, justifyContent: 'center' },
  link: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, ...rtl.text },
});
