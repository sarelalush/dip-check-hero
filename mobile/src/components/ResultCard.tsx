import { StyleSheet, Text, View } from 'react-native';
import type { DosageRecommendation } from '../domain/dosage';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { LineIcon } from './LineIcon';

const STATUS_STYLE: Record<
  DosageRecommendation['status'],
  { backgroundColor: string; borderColor: string; color: string; label: string }
> = {
  ok: { backgroundColor: colors.successSoft, borderColor: 'rgba(34,185,131,0.3)', color: colors.success, label: 'תקין' },
  low: { backgroundColor: colors.warningSoft, borderColor: 'rgba(240,165,41,0.34)', color: colors.warning, label: 'נמוך' },
  high: { backgroundColor: colors.dangerSoft, borderColor: 'rgba(231,92,98,0.3)', color: colors.danger, label: 'גבוה' },
};

function formatValue(value: number, unit: string) {
  const display = Number.isInteger(value) ? `${value}` : `${value.toFixed(1)}`;
  return unit ? `${display} ${unit}` : display;
}

function splitSteps(action: string) {
  return action
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface ResultCardProps {
  rec: DosageRecommendation;
}

export function ResultCard({ rec }: ResultCardProps) {
  const status = STATUS_STYLE[rec.status];
  const steps = splitSteps(rec.actionHe);
  const isActive = Boolean(rec.active);

  return (
    <View style={[styles.card, { backgroundColor: status.backgroundColor, borderColor: status.borderColor }, isActive && styles.activeCard]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconWrap, { backgroundColor: colors.white }]}>
            <LineIcon name={rec.status === 'ok' ? 'check' : 'help'} color={status.color} size={15} />
          </View>
          <View style={styles.titleCopy}>
            <Text style={styles.title}>{rec.labelHe}</Text>
            {isActive ? <Text style={styles.activeBadge}>לטיפול עכשיו</Text> : null}
          </View>
        </View>
        <View style={[styles.statusBadge, { borderColor: status.borderColor }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>

      <View style={styles.valuesRow}>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>נמדד</Text>
          <Text style={styles.valueText}>{formatValue(rec.measured, rec.unit)}</Text>
        </View>
        <View style={styles.valueBox}>
          <Text style={styles.valueLabel}>יעד</Text>
          <Text style={styles.valueText}>{formatValue(rec.target, rec.unit)}</Text>
        </View>
      </View>

      {isActive ? (
        <View style={styles.recommendationBox}>
          <Text style={styles.recommendationLabel}>המלצה</Text>
          {steps.length <= 1 ? (
            <Text style={styles.recommendationText}>{rec.actionHe}</Text>
          ) : (
            <View style={styles.steps}>
              {steps.map((step, index) => (
                <View key={`${rec.paramKey}-step-${index}`} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ) : rec.status !== 'ok' ? (
        <Text style={styles.waitingText}>ממתין - נטפל לאחר השלמת הצעד הקודם.</Text>
      ) : null}
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
  recommendationBox: {
    marginTop: 12,
    borderRadius: 15,
    backgroundColor: colors.white,
    padding: 12,
  },
  recommendationLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 8,
    ...rtl.text,
  },
  recommendationText: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    lineHeight: 20,
    ...rtl.text,
  },
  steps: {
    gap: 8,
  },
  stepRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 11,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 18,
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
