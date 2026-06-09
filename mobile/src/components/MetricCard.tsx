import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { StatusTone } from './StatusBadge';

interface MetricCardProps {
  label: string;
  value: string;
  status: string;
  tone?: StatusTone;
}

export function MetricCard({ label, value, status, tone = 'success' }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.status, { color: tone === 'success' ? colors.success : colors.warning }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 82,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 5,
    ...shadows.soft,
  },
  label: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '900',
    ...rtl.text,
  },
  value: {
    color: colors.success,
    fontFamily: typography.fontFamilyBold,
    fontSize: 19,
    fontWeight: '900',
    ...rtl.text,
  },
  status: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.textCenter,
  },
});
