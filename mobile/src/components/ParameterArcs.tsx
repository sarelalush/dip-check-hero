import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { ScanParameterStatusKind } from '../domain/scanResults';
import type { StripParameter } from '../domain/strip';
import { colors, radius, rtl, shadows, typography } from '../theme';
import PRO_CHART from '../../../supabase/functions/_shared/aquachek-pro-chart.json';

const DISPLAY_RANGE: Record<string, { min: number; max: number }> = {
  cyanuricAcid: { min: 0, max: 150 },
  salt: { min: 0, max: 6000 },
  hardness: { min: 0, max: 1000 },
  ...Object.fromEntries(Object.entries(PRO_CHART.parameters).map(([key, levels]) =>
    [key, { min: levels[0].value, max: levels[levels.length - 1].value }])),
};

const STATUS_COLOR: Record<ScanParameterStatusKind, string> = {
  ok: colors.success,
  low: colors.warning,
  high: colors.danger,
};

const STATUS_LABEL: Record<ScanParameterStatusKind, string> = {
  ok: 'בטווח לפי ההערכה',
  low: 'נמוך',
  high: 'גבוה',
};

const SVG_WIDTH = 220;
const SVG_HEIGHT = 132;
const CX = SVG_WIDTH / 2;
const CY = 122;
const RING_GAP = 14;
const RING_THICK = 10;
const BASE_RADIUS = 38;
const START_ANGLE = 180;
const END_ANGLE = 360;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function arcPath(cx: number, cy: number, radius: number, startDeg: number, endDeg: number) {
  const start = polar(cx, cy, radius, startDeg);
  const end = polar(cx, cy, radius, endDeg);
  const delta = Math.abs(endDeg - startDeg);
  const largeArc = delta > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${end.x} ${end.y}`;
}

function rangeFor(rec: ParameterArcReading) {
  return DISPLAY_RANGE[rec.paramKey] ?? { min: 0, max: Math.max((rec.target ?? 0) * 2, rec.measured * 1.2, 1) };
}

function formatValue(value: number, unit: string, estimated = false) {
  const display = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  return `${estimated ? 'כ־' : ''}\u2066${unit ? `${display} ${unit}` : display}\u2069`;
}

// Measurement-only entries (such as total chlorine) have no borrowed
// free-chlorine target or low/ok/high classification.
export interface ParameterArcReading {
  paramKey: StripParameter;
  labelHe: string;
  measured: number;
  unit: string;
  target?: number;
  status?: ScanParameterStatusKind;
  estimated?: boolean;
  requiresReview?: boolean;
  reviewLabel?: string;
}

function readingColor(rec: ParameterArcReading) {
  if (rec.requiresReview) return '#8A5600';
  return rec.status ? STATUS_COLOR[rec.status] : colors.primaryDeep;
}

interface ParameterArcsProps {
  recs: ParameterArcReading[];
}

export function ParameterArcs({ recs }: ParameterArcsProps) {
  const ordered = recs.slice(0, 6);

  if (!ordered.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.statusColumn}>
          {ordered.map((rec) => {
            const color = readingColor(rec);
            return (
              <View key={`label-${rec.paramKey}`} style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>{rec.requiresReview ? rec.reviewLabel ?? 'קריאה בין טווחים' : rec.status ? STATUS_LABEL[rec.status]
                    : rec.estimated ? 'קריאה משוערת' : 'הערכה מצילום'}</Text>
                  <Text style={styles.statusName} numberOfLines={1}>
                    {rec.labelHe}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Svg width={180} height={124} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={styles.arcSvg}>
          {ordered.map((rec, index) => {
            const radius = BASE_RADIUS + (ordered.length - 1 - index) * RING_GAP;
            const range = rangeFor(rec);
            const valuePct = clamp01((rec.measured - range.min) / (range.max - range.min));
            const targetPct = typeof rec.target === 'number' && Number.isFinite(rec.target)
              ? clamp01((rec.target - range.min) / (range.max - range.min)) : undefined;
            const valueAngle = START_ANGLE + (END_ANGLE - START_ANGLE) * valuePct;
            const targetMark = targetPct === undefined ? undefined
              : polar(CX, CY, radius, START_ANGLE + (END_ANGLE - START_ANGLE) * targetPct);
            const valueMark = polar(CX, CY, radius, valueAngle);
            const statusColor = readingColor(rec);

            return (
              <G key={`ring-${rec.paramKey}`}>
                <Path
                  d={arcPath(CX, CY, radius, START_ANGLE, END_ANGLE)}
                  fill="none"
                  stroke="#E7F2F5"
                  strokeLinecap="round"
                  strokeWidth={RING_THICK}
                />
                {valuePct > 0.01 ? (
                  <Path
                    d={arcPath(CX, CY, radius, START_ANGLE, Math.max(START_ANGLE + 1, valueAngle))}
                    fill="none"
                    stroke={statusColor}
                    strokeLinecap="round"
                    strokeOpacity={0.94}
                    strokeWidth={RING_THICK}
                  />
                ) : null}
                {valuePct > 0.01 ? <Circle cx={valueMark.x} cy={valueMark.y} fill={statusColor} r={RING_THICK * 0.46} /> : null}
                {targetMark ? <Line
                  x1={targetMark.x}
                  x2={targetMark.x}
                  y1={targetMark.y - RING_THICK / 2 - 2}
                  y2={targetMark.y + RING_THICK / 2 + 2}
                  stroke={colors.text}
                  strokeLinecap="round"
                  strokeOpacity={0.52}
                  strokeWidth={2}
                /> : null}
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendMeta}>מדד</Text>
          <Text style={styles.legendMeta}>הערכה מצילום</Text>
        </View>
        {ordered.map((rec) => {
          return (
            <View key={`row-${rec.paramKey}`} style={styles.legendRow}>
              <View style={styles.legendRight}>
                <Text style={styles.paramName}>{rec.labelHe}</Text>
                {typeof rec.target === 'number' && Number.isFinite(rec.target) ? (
                  <Text style={styles.target}>מרכז טווח ההשוואה: {formatValue(rec.target, rec.unit)}</Text>
                ) : null}
              </View>
              <View style={styles.legendLeft}>
                <Text style={[styles.valuePill, { backgroundColor: readingColor(rec) }]}>
                  {formatValue(rec.measured, rec.unit, rec.estimated)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 16,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  arcSvg: {
    marginTop: 2,
  },
  statusColumn: {
    flex: 1,
    paddingTop: 0,
    gap: 10,
  },
  statusItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  statusDot: {
    marginTop: 4,
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  statusCopy: {
    flex: 1,
  },
  statusLabel: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  statusName: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  legend: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    paddingTop: 12,
    gap: 9,
  },
  legendHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendMeta: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  legendRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  legendLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  legendRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  valuePill: {
    overflow: 'hidden',
    borderRadius: radius.round,
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 10,
    paddingVertical: 4,
    ...rtl.textCenter,
  },
  paramName: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  target: {
    marginTop: 2,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
});
