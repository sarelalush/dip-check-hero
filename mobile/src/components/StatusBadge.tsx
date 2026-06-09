import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, typography } from '../theme';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const toneMap: Record<StatusTone, { backgroundColor: string; color: string }> = {
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  neutral: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
};

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

export function StatusBadge({ label, tone = 'success' }: StatusBadgeProps) {
  const palette = toneMap[tone];

  return (
    <View style={[styles.badge, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.text, { color: palette.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 11,
    fontWeight: '900',
    ...rtl.textCenter,
  },
});
