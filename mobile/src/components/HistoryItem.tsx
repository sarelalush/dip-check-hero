import { StyleSheet, Text, View } from 'react-native';
import { colors, rtl, shadows, typography } from '../theme';
import { LineIcon } from './LineIcon';
import type { StatusTone } from './StatusBadge';

interface HistoryItemProps {
  date: string;
  poolName: string;
  status: string;
  time: string;
  tone?: StatusTone;
}

export function HistoryItem({ date, poolName, status, time, tone = 'success' }: HistoryItemProps) {
  const iconColor = tone === 'success' ? colors.success : colors.warning;

  return (
    <View style={styles.item}>
      <View style={[styles.icon, { backgroundColor: tone === 'success' ? colors.successSoft : colors.warningSoft }]}>
        <LineIcon name={tone === 'success' ? 'check' : 'help'} color={iconColor} size={17} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.date}>{date}</Text>
        <Text style={styles.poolName}>{status}</Text>
        <Text style={styles.time}>{time}</Text>
      </View>
      <LineIcon name="chevronLeft" color={colors.muted} size={18} />
    </View>
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
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
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
  time: {
    marginTop: 3,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 10,
    fontWeight: '800',
    ...rtl.text,
  },
});
