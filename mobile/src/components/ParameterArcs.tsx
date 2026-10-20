import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path } from 'react-native-svg';
import type { ScanParameterStatusKind } from '../domain/scanResults';
import type { StripParameter } from '../domain/strip';
import { colors, rtl, typography } from '../theme';
import PRO_CHART from '../../../supabase/functions/_shared/aquachek-pro-chart.json';

const DISPLAY_RANGE: Record<string, { min: number; max: number }> = {
  cyanuricAcid: { min: 0, max: 150 }, salt: { min: 0, max: 6000 }, hardness: { min: 0, max: 1000 },
  ...Object.fromEntries(Object.entries(PRO_CHART.parameters).map(([key, levels]) =>
    [key, { min: levels[0].value, max: levels[levels.length - 1].value }])),
};
const STATUS_COLOR = { ok: '#1D7056', low: '#80521D', high: '#A23C4C' };
const ARC_COLOR = { ok: colors.success, low: colors.warning, high: colors.danger };
const CX = 110;
const CY = 122;
const RING_GAP = 14;
const RING_THICK = 10;
const BASE_RADIUS = 38;

export interface ParameterArcReading {
  paramKey: StripParameter;
  labelHe: string;
  measured?: number;
  unit: string;
  target?: number;
  comparisonRange?: { min: number; max: number };
  status?: ScanParameterStatusKind;
  estimated?: boolean;
  requiresReview?: boolean;
  reviewLabel?: string;
  usesUpperCandidate?: boolean;
}

function readable(rec: ParameterArcReading): rec is ParameterArcReading & { measured: number } {
  return typeof rec.measured === 'number' && Number.isFinite(rec.measured) && rec.measured >= 0;
}
function colorFor(rec: ParameterArcReading, arc = false) {
  if (!readable(rec)) return colors.textSoft;
  if (rec.status && rec.status !== 'ok') return arc ? ARC_COLOR[rec.status] : STATUS_COLOR[rec.status];
  if (rec.requiresReview && (rec.paramKey === 'totalChlorine' || !rec.status)) return arc ? colors.warning : '#946023';
  return rec.status ? arc ? ARC_COLOR[rec.status] : STATUS_COLOR[rec.status] : colors.primaryDeep;
}
function statusLabel(rec: ParameterArcReading) {
  if (!readable(rec)) return 'לא נקרא';
  const base = rec.status === 'high' ? 'גבוה' : rec.status === 'low' ? 'נמוך' : rec.status === 'ok' ? 'בטווח' : 'ללא טווח השוואה';
  if (rec.usesUpperCandidate) return `${base}. מוצגת האפשרות הגבוהה מבין שתי התאמות למקרא; זו הערכה מצילום.`;
  const review = rec.requiresReview ? rec.reviewLabel ?? 'יש יותר מהתאמה אחת למקרא' : undefined;
  return review ? `${base}. ההתאמה למקרא אינה חד־משמעית: ${review}` : base;
}
function tileStatus(rec: ParameterArcReading) {
  if (rec.usesUpperCandidate && readable(rec) && rec.status)
    return rec.status === 'high' ? 'גבוה' : rec.status === 'low' ? 'נמוך' : 'בטווח';
  // The overview heading already states the pair problem in full. Keep the
  // metric's high/low result prominent rather than repeating that whole warning.
  const pairReview = rec.paramKey === 'totalChlorine' && rec.requiresReview &&
    (rec.reviewLabel === 'חשד לכלור קשור' || rec.reviewLabel === 'קריאות סותרות');
  if (pairReview && readable(rec)) {
    if (rec.status === 'high') return 'גבוה';
    if (rec.status === 'low') return 'נמוך';
    if (rec.status === 'ok') return 'פער בכלור';
  }
  if (rec.paramKey === 'totalChlorine' && rec.requiresReview) return 'צילום חוזר';
  return !readable(rec) ? 'לא נקרא' : rec.status === 'high' ? 'גבוה' : rec.status === 'low' ? 'נמוך'
    : rec.status === 'ok' ? 'בטווח' : 'ללא טווח השוואה';
}
function tileBackground(rec: ParameterArcReading) {
  if (!readable(rec)) return '#F7FAFC';
  if (rec.status === 'high') return '#FFFAFA';
  if (rec.status === 'low' || (rec.requiresReview && rec.paramKey === 'totalChlorine')) return '#FFFCF6';
  return '#F8FCFD';
}
function tileBorder(rec: ParameterArcReading) {
  if (!readable(rec)) return '#E4EDF2';
  if (rec.status === 'high') return '#F4DEDF';
  if (rec.status === 'low' || (rec.requiresReview && rec.paramKey === 'totalChlorine')) return '#F1E4CA';
  return '#DDECF0';
}
function badgeBackground(rec: ParameterArcReading) {
  if (!readable(rec)) return '#EAF0F4';
  if (rec.status === 'high') return '#FBEAEC';
  if (rec.status === 'low' || (rec.requiresReview && rec.paramKey === 'totalChlorine')) return '#FFF0D5';
  return rec.status === 'ok' ? '#E6F5EE' : '#EAF2F6';
}
function formatValue(rec: ParameterArcReading) {
  if (!readable(rec)) return '—';
  const value = displayNumber(rec);
  return `${rec.estimated ? 'כ־' : ''}\u2066${value}${rec.unit ? ` ${rec.unit}` : ''}\u2069`;
}
function displayNumber(rec: ParameterArcReading) {
  if (!readable(rec)) return '—';
  return rec.measured.toLocaleString('he-IL', { maximumFractionDigits: 1 });
}
function polar(radius: number, angle: number) {
  const radians = angle * Math.PI / 180;
  return { x: CX + radius * Math.cos(radians), y: CY + radius * Math.sin(radians) };
}
function arcPath(radius: number, endAngle: number) {
  const start = polar(radius, 180);
  const end = polar(radius, endAngle);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
}
function rangeFor(rec: ParameterArcReading) {
  const sourceRange = rec.comparisonRange;
  const supplied = sourceRange && Number.isFinite(sourceRange.min) && Number.isFinite(sourceRange.max) &&
    sourceRange.min <= sourceRange.max ? sourceRange : undefined;
  const display = DISPLAY_RANGE[rec.paramKey];
  // Frame the existing arc using the chart scale, expanding for an outside
  // reading/range. Display geometry never supplies a comparison range or dose.
  const min = Math.min(display?.min ?? 0, supplied?.min ?? display?.min ?? 0,
    readable(rec) ? rec.measured : display?.min ?? 0);
  const max = Math.max(display?.max ?? 1, supplied?.max ?? 0, readable(rec) ? rec.measured : 0, min + 1);
  return { min, max };
}

export function ParameterArcs({ recs }: { recs: ParameterArcReading[] }) {
  const ordered = recs.slice(0, 6);
  if (!ordered.length) return null;
  const radius = BASE_RADIUS + (ordered.length - 1) * RING_GAP;
  const padding = RING_THICK / 2 + 3;
  const bounds = `${CX - radius - padding} ${CY - radius - padding} ${2 * (radius + padding)} ${radius + 2 * padding}`;
  return (
    <View style={styles.chart}>
      <View style={styles.plot}>
        {/* Keep the plot in one SVG. A positioned opaque View can paint above
            the web SVG and cover its inner rings, regardless of JSX order. */}
        <Svg width="100%" height={134} viewBox={bounds} preserveAspectRatio="xMidYMid meet" style={styles.arcSvg} accessible={false}>
          {ordered.map((rec, index) => {
            const r = BASE_RADIUS + (ordered.length - 1 - index) * RING_GAP;
            const range = rangeFor(rec);
            const fraction = readable(rec) ? Math.max(0, Math.min(1, (rec.measured - range.min) / (range.max - range.min))) : undefined;
            const valueAngle = fraction === undefined ? undefined : 180 + 180 * fraction;
            const valueMark = valueAngle === undefined ? undefined : polar(r, valueAngle);
            const target = typeof rec.target === 'number' && Number.isFinite(rec.target)
              ? polar(r, 180 + 180 * Math.max(0, Math.min(1, (rec.target - range.min) / (range.max - range.min)))) : undefined;
            return <G key={rec.paramKey}>
              <Path d={arcPath(r, 360)} fill="none" stroke="#E4EFF2" strokeWidth={RING_THICK} strokeLinecap="round" />
              {fraction !== undefined && fraction > 0.001 ?
                <Path d={arcPath(r, valueAngle!)} fill="none" stroke={colorFor(rec, true)}
                  strokeWidth={RING_THICK} strokeLinecap="round" /> : null}
              {valueMark ? <>
                <Circle cx={valueMark.x} cy={valueMark.y} r={RING_THICK * 0.7} fill={colors.surface} />
                <Circle cx={valueMark.x} cy={valueMark.y} r={RING_THICK * 0.46} fill={colorFor(rec, true)} />
              </> : null}
              {target ? <Line x1={target.x} x2={target.x} y1={target.y - 7} y2={target.y + 7}
                stroke={colors.textSoft} strokeWidth={1.5} strokeOpacity={0.65} strokeLinecap="round" /> : null}
            </G>;
          })}
        </Svg>
      </View>
      <View style={styles.readings}>
        {ordered.map(rec => (
          <View key={rec.paramKey} style={[styles.reading, { backgroundColor: tileBackground(rec), borderColor: tileBorder(rec) }]} accessible
            accessibilityLabel={`${rec.labelHe}, ${formatValue(rec)}, ${statusLabel(rec)}`}>
            <Text style={styles.name}>{rec.paramKey === 'ph' ? 'חומציות' : rec.labelHe}</Text>
            <View style={styles.valueRow}>
              {readable(rec) && rec.estimated ? <Text style={styles.approximation}>כ־</Text> : null}
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {displayNumber(rec)}
              </Text>
            </View>
            <Text style={styles.unit}>{rec.paramKey === 'ph' ? 'pH' : rec.unit || ' '}</Text>
            <View style={[styles.statusRow, { backgroundColor: badgeBackground(rec) }]}>
              <View style={[styles.dot, { backgroundColor: colorFor(rec) }]} />
              <Text style={[styles.status, { color: colorFor(rec) }]}>{tileStatus(rec)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: 14 },
  plot: { alignSelf: 'center', width: '100%', maxWidth: 244, height: 134, justifyContent: 'center' },
  arcSvg: { position: 'relative', zIndex: 1 },
  readings: { ...rtl.row, alignItems: 'stretch', gap: 8 },
  reading: { flex: 1, minWidth: 0, paddingHorizontal: 7, paddingTop: 13, paddingBottom: 11, borderRadius: 18,
    borderWidth: 1, alignItems: 'center', gap: 4 },
  name: { width: '100%', minHeight: 22, color: '#36576C', fontFamily: typography.fontFamilySemiBold, fontSize: 12,
    lineHeight: 20, ...rtl.textCenter },
  valueRow: { ...rtl.row, alignItems: 'baseline', justifyContent: 'center', maxWidth: '100%', gap: 2, minHeight: 41, marginTop: 2 },
  approximation: { color: '#6C8494', fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 24, ...rtl.text },
  value: { flexShrink: 1, color: '#153C53', fontFamily: typography.fontFamilyBold, fontSize: 30, lineHeight: 41,
    fontVariant: ['tabular-nums'], writingDirection: 'ltr', textAlign: 'center' },
  unit: { minHeight: 17, color: '#6B8393', fontFamily: typography.fontFamilyMedium, fontSize: 11, lineHeight: 17,
    writingDirection: 'ltr', textAlign: 'center' },
  statusRow: { ...rtl.row, maxWidth: '100%', justifyContent: 'center', alignItems: 'center', gap: 4,
    borderRadius: 9, minHeight: 26, paddingHorizontal: 7, paddingVertical: 4, marginTop: 'auto' },
  dot: { width: 4, height: 4, borderRadius: 2, flexShrink: 0 },
  status: { flexShrink: 1, fontFamily: typography.fontFamilySemiBold, fontSize: 11, lineHeight: 17, ...rtl.textCenter },
});
