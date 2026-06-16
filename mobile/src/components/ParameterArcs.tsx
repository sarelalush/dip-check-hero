import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import type { DosageRecommendation } from '../domain/dosage';
import { colors, radius, rtl, shadows, typography } from '../theme';

const DISPLAY_RANGE: Record<string, { min: number; max: number }> = {
  freeChlorine: { min: 0, max: 6 },
  ph: { min: 6.2, max: 8.4 },
  alkalinity: { min: 0, max: 240 },
  cyanuricAcid: { min: 0, max: 150 },
  salt: { min: 0, max: 6000 },
  totalChlorine: { min: 0, max: 10 },
  bromine: { min: 0, max: 20 },
  hardness: { min: 0, max: 1000 },
};

const STATUS_COLOR: Record<DosageRecommendation['status'], string> = {
  ok: colors.success,
  low: colors.warning,
  high: colors.danger,
};

const STATUS_LABEL: Record<DosageRecommendation['status'], string> = {
  ok: 'תקין',
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
const END_ANGLE = 0;

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

function rangeFor(rec: DosageRecommendation) {
  return DISPLAY_RANGE[rec.paramKey] ?? { min: 0, max: Math.max(rec.target * 2, rec.measured * 1.2, 1) };
}

function formatValue(value: number, unit: string) {
  const display = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  return unit ? `${display} ${unit}` : display;
}

interface ParameterArcsProps {
  recs: DosageRecommendation[];
}

export function ParameterArcs({ recs }: ParameterArcsProps) {
  const ordered = recs.slice(0, 6);

  if (!ordered.length) return null;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.statusColumn}>
          {ordered.map((rec) => {
            const color = STATUS_COLOR[rec.status];
            return (
              <View key={`label-${rec.paramKey}`} style={styles.statusItem}>
                <View style={[styles.statusDot, { backgroundColor: color }]} />
                <View style={styles.statusCopy}>
                  <Text style={styles.statusLabel}>{STATUS_LABEL[rec.status]}</Text>
                  <Text style={styles.statusName} numberOfLines={1}>
                    {rec.labelHe}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>

        <Svg width={178} height={124} viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} style={styles.arcSvg}>
          <Defs>
            {ordered.map((rec) => (
              <LinearGradient key={`grad-${rec.paramKey}`} id={`grad-${rec.paramKey}`} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={STATUS_COLOR[rec.status]} stopOpacity={0.42} />
                <Stop offset="100%" stopColor={STATUS_COLOR[rec.status]} stopOpacity={1} />
              </LinearGradient>
            ))}
          </Defs>

          {ordered.map((rec, index) => {
            const radius = BASE_RADIUS + (ordered.length - 1 - index) * RING_GAP;
            const range = rangeFor(rec);
            const valuePct = clamp01((rec.measured - range.min) / (range.max - range.min));
            const targetPct = clamp01((rec.target - range.min) / (range.max - range.min));
            const valueAngle = START_ANGLE + (END_ANGLE - START_ANGLE) * valuePct;
            const targetAngle = START_ANGLE + (END_ANGLE - START_ANGLE) * targetPct;
            const targetMark = polar(CX, CY, radius, targetAngle);

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
                    d={arcPath(CX, CY, radius, START_ANGLE, Math.min(START_ANGLE - 1, valueAngle))}
                    fill="none"
                    stroke={`url(#grad-${rec.paramKey})`}
                    strokeLinecap="round"
                    strokeWidth={RING_THICK}
                  />
                ) : null}
                <Line
                  x1={targetMark.x}
                  x2={targetMark.x}
                  y1={targetMark.y - RING_THICK / 2 - 2}
                  y2={targetMark.y + RING_THICK / 2 + 2}
                  stroke={colors.text}
                  strokeLinecap="round"
                  strokeOpacity={0.52}
                  strokeWidth={2}
                />
              </G>
            );
          })}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendMeta}>נקודת יעד</Text>
          <Text style={styles.legendMeta}>ערך נוכחי</Text>
        </View>
        {ordered.map((rec) => {
          const range = rangeFor(rec);
          const pct = Math.round(clamp01((rec.measured - range.min) / (range.max - range.min)) * 100);
          return (
            <View key={`row-${rec.paramKey}`} style={styles.legendRow}>
              <View style={styles.legendLeft}>
                <Text style={[styles.valuePill, { backgroundColor: STATUS_COLOR[rec.status] }]}>{formatValue(rec.measured, rec.unit)}</Text>
                <Text style={styles.percent}>{pct}%</Text>
              </View>
              <View style={styles.legendRight}>
                <Text style={styles.paramName}>{rec.labelHe}</Text>
                <Text style={styles.target}>יעד {formatValue(rec.target, rec.unit)}</Text>
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
  percent: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
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
