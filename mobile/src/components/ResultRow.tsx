import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { StatusBadge, type StatusTone } from './StatusBadge';

interface ResultRowProps {
  label: string;
  range: string;
  status: string;
  tone?: StatusTone;
  value: string;
  progress: number;
}

export function ResultRow({ label, range, status, tone = 'success', value, progress }: ResultRowProps) {
  const progressColor = tone === 'warning' ? colors.warning : tone === 'danger' ? colors.danger : colors.success;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.range}>{range}</Text>
        </View>
        <Text style={styles.value}>{value}</Text>
        <StatusBadge label={status} tone={tone} />
      </View>
      <View style={styles.track}>
        <View style={[styles.progress, { width: `${Math.max(8, Math.min(100, progress))}%`, backgroundColor: progressColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 11,
    paddingHorizontal: 13,
    gap: 9,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
  },
  titleWrap: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.text,
  },
  range: {
    marginTop: 3,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
  value: {
    minWidth: 58,
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'left',
  },
  track: {
    height: 5,
    borderRadius: radius.round,
    backgroundColor: '#E8F0F2',
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: radius.round,
    backgroundColor: colors.success,
  },
});
