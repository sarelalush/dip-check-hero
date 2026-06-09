import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rtl, shadows, typography } from '../theme';
import { StatusBadge, type StatusTone } from './StatusBadge';
import { LineIcon } from './LineIcon';
import { PoolPhoto } from './WaterVisuals';

interface PoolCardProps {
  name: string;
  volume: string;
  status: string;
  tone?: StatusTone;
  onPress?: () => void;
  variant?: 'villa' | 'city';
}

export function PoolCard({ name, volume, status, tone = 'success', onPress, variant = 'villa' }: PoolCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.visual}>
        <PoolPhoto variant={variant} />
      </View>
      <View style={styles.body}>
        <View style={styles.row}>
          <View style={styles.more}>
            <LineIcon name="more" color={colors.textSoft} size={18} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.volume}>{volume}</Text>
          </View>
        </View>
        <StatusBadge label={status} tone={tone} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    ...shadows.card,
  },
  visual: {
    height: 118,
    backgroundColor: colors.waterDeep,
    overflow: 'hidden',
  },
  body: {
    padding: 13,
    gap: 9,
    alignItems: 'flex-end',
  },
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  copy: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 15,
    fontWeight: '900',
    ...rtl.text,
  },
  volume: {
    marginTop: 4,
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  more: {
    marginTop: -6,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
});
