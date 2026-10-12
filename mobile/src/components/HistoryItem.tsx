import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rtl, shadows, typography } from '../theme';
import { LineIcon } from './LineIcon';
import type { StatusTone } from './StatusBadge';

interface HistoryItemProps {
  date: string;
  onPress?: () => void;
  poolName: string;
  showPoolName?: boolean;
  status: string;
  time: string;
  tone?: StatusTone;
}

export function HistoryItem({
  date,
  onPress,
  poolName,
  showPoolName = true,
  status,
  time,
  tone = 'success',
}: HistoryItemProps) {
  const iconColor = tone === 'success' ? colors.success : colors.warning;

  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${poolName}, ${date}, ${status}, ${time}`}
      onPress={onPress}
      style={({ pressed }) => [styles.item, pressed && onPress && styles.pressed]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: tone === 'success' ? colors.successSoft : colors.warningSoft },
        ]}
      >
        <LineIcon name={tone === 'success' ? 'check' : 'help'} color={iconColor} size={17} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.date}>{date}</Text>
        {showPoolName ? <Text style={styles.poolName}>{poolName}</Text> : null}
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.time} numberOfLines={1}>
          {time}
        </Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.muted} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    minHeight: 74,
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...shadows.soft,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
  },
  date: {
    color: colors.text,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    ...rtl.text,
  },
  poolName: {
    marginTop: 3,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  status: {
    marginTop: 2,
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '800',
    ...rtl.text,
  },
  time: {
    marginTop: 3,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    ...rtl.text,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
