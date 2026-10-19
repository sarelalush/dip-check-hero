import { StyleSheet, Text, View } from 'react-native';
import type { DosageRecommendation } from '../domain/dosage';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { LineIcon } from './LineIcon';
import type { PadColor } from '../domain/padColor';
import { MeasurementCard, type MeasurementTone } from './MeasurementCard';
import { MEASUREMENT_COPY } from '../domain/measurementPresentation';

const STATUS_STYLE: Record<
  DosageRecommendation['status'],
  { backgroundColor: string; borderColor: string; color: string; label: string }
> = {
  ok: {
    backgroundColor: colors.successSoft,
    borderColor: 'rgba(34,185,131,0.3)',
    color: colors.success,
    label: 'בטווח לפי ההערכה',
  },
  low: {
    backgroundColor: colors.warningSoft,
    borderColor: 'rgba(240,165,41,0.34)',
    color: colors.warning,
    label: 'נמוך',
  },
  high: {
    backgroundColor: colors.dangerSoft,
    borderColor: 'rgba(231,92,98,0.3)',
    color: colors.danger,
    label: 'גבוה',
  },
};

function formatValue(value: number, unit: string, estimated = false) {
  const display = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  return `${estimated ? 'כ־' : ''}\u2066${unit ? `${display} ${unit}` : display}\u2069`;
}

interface ResultCardProps {
  rec: DosageRecommendation;
  compact?: boolean;
  padColor?: PadColor;
  showPadColor?: boolean;
  padPosition?: number;
}

export function ResultCard({ rec, compact = false, padColor, showPadColor = false, padPosition }: ResultCardProps) {
  const status = STATUS_STYLE[rec.status];
  const reviewLabel = rec.actionUncertain ? 'קריאה בין טווחים' : status.label;
  const tone: MeasurementTone = rec.actionUncertain ? 'warning'
    : rec.status === 'ok' ? 'success' : rec.status === 'high' ? 'danger' : 'warning';
  const displayStyle = rec.actionUncertain ? {
    backgroundColor: colors.warningSoft, borderColor: '#E8D4A5', color: '#8A5600',
  } : status;
  const isActive = Boolean(rec.active);
  const verificationNote = rec.alternativeMeasured !== undefined && Number.isFinite(rec.alternativeMeasured) &&
    rec.alternativeMeasured !== rec.measured
    ? `הצבע קרוב גם ל־${formatValue(rec.alternativeMeasured, rec.unit)}.`
    : 'הערכה מצילום. פרטי הקריאה מופיעים במידע הנוסף.';
  const waitingText = rec.paramKey === 'freeChlorine' && rec.status === 'high'
    ? 'אין להוסיף עוד כלור. בדוק שוב לפני טיפול נוסף.'
    : 'הטיפול במדד הזה ייקבע בבדיקה הבאה.';

  if (compact) {
    const copy = MEASUREMENT_COPY[rec.paramKey];
    const range = rec.comparisonRange;
    const comparisonText = range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.min <= range.max
      ? `טווח השוואה: \u2066${range.min}–${range.max}${rec.unit ? ` ${rec.unit}` : ''}\u2069` : undefined;
    const alternativeNote = rec.verificationSuggested && rec.alternativeMeasured !== undefined &&
      Number.isFinite(rec.alternativeMeasured) && rec.alternativeMeasured !== rec.measured
      ? `הצבע קרוב גם ל־${formatValue(rec.alternativeMeasured, rec.unit)}.` : undefined;
    const actionNote = rec.actionUncertain
      ? 'הצבע בין שתי דרגות שמשנות את הטיפול. בדוק שוב לפני הוספת חומר.'
      : rec.status === 'ok' ? undefined
      : rec.active ? 'זה המדד שמטפלים בו קודם. ההוראות מופיעות למעלה.'
      : waitingText;
    return (
      <MeasurementCard label={copy.label} description={copy.description} explanation={copy.explanation}
        padPosition={padPosition} value={formatValue(rec.measured, rec.unit, true)}
        status={rec.actionUncertain ? 'בין שני טווחים' : rec.status === 'ok' ? 'בטווח לפי הצילום'
          : rec.status === 'high' ? 'גבוה מהטווח' : 'נמוך מהטווח'} tone={tone} detail={comparisonText}
        note={[actionNote, rec.actionUncertain ? alternativeNote : undefined].filter(Boolean).join(' ')}
        detailNote={!rec.actionUncertain ? alternativeNote : undefined}
        showPadColor={showPadColor} padColor={padColor} />
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: displayStyle.backgroundColor, borderColor: displayStyle.borderColor },
        isActive && styles.activeCard,
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.white }]}>
            <LineIcon
              name={rec.status === 'ok' && !rec.actionUncertain ? 'check' : 'help'}
              color={displayStyle.color}
              size={15}
            />
          </View>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{rec.labelHe}</Text>
            {isActive ? <Text style={styles.activeBadge}>הצעד הבא</Text> : null}
          </View>
        </View>
        <View style={[styles.statusBadge, { borderColor: displayStyle.borderColor }]}>
          <Text style={[styles.statusText, { color: displayStyle.color }]}>{reviewLabel}</Text>
        </View>
      </View>

      <View style={styles.valuesRow}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>הערכה מצילום</Text>
          <Text style={styles.valueText}>{formatValue(rec.measured, rec.unit, true)}</Text>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>מרכז טווח ההשוואה</Text>
          <Text style={styles.valueText}>{formatValue(rec.target, rec.unit)}</Text>
        </View>
      </View>

      {rec.verificationSuggested ? <Text style={styles.waitingText}>{verificationNote}</Text> : null}
      {rec.status !== 'ok' && !isActive
        ? <Text style={styles.waitingText}>{waitingText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 15,
    ...shadows.soft,
  },
  activeCard: {
    borderColor: colors.primary,
    shadowColor: colors.primaryDark,
    shadowOpacity: 0.13,
    shadowRadius: 18,
    elevation: 5,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleRow: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCopy: {
    flex: 1,
    alignItems: 'flex-end',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    fontWeight: '900',
    ...rtl.text,
  },
  activeBadge: {
    marginTop: 3,
    overflow: 'hidden',
    borderRadius: radius.round,
    backgroundColor: colors.primary,
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 10,
    fontWeight: '900',
    paddingHorizontal: 9,
    paddingVertical: 3,
    ...rtl.textCenter,
  },
  statusBadge: {
    borderWidth: 1,
    borderRadius: radius.round,
    backgroundColor: colors.whiteSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  valuesRow: {
    marginTop: 12,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  valueBox: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.68)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  valueLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  valueText: {
    marginTop: 3,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  waitingText: {
    marginTop: 11,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 11,
    fontWeight: '800',
    ...rtl.text,
  },
});
