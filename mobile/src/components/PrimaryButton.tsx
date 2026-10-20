import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { LineIcon, type LineIconName } from './LineIcon';

interface PrimaryButtonProps {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  icon?: LineIconName;
  onPress?: () => void;
  variant?: 'default' | 'refined';
}

export function PrimaryButton({ busy = false, disabled = false, label, icon, onPress, variant = 'default' }: PrimaryButtonProps) {
  const isDisabled = disabled || busy;
  const refined = variant === 'refined';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(busy) }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, refined && styles.refinedButton, isDisabled && styles.disabled, pressed && !isDisabled && styles.pressed]}
    >
      {busy ? (
        <View style={[styles.icon, refined && styles.refinedIcon]}>
          <ActivityIndicator color={refined ? colors.white : colors.primary} size="small" />
        </View>
      ) : icon ? (
        <View style={[styles.icon, refined && styles.refinedIcon]}>
          <LineIcon name={icon} color={refined ? colors.white : colors.primary} size={18} />
        </View>
      ) : null}
      <Text style={[styles.label, refined && styles.refinedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  refinedButton: { minHeight: 50, borderRadius: 15, backgroundColor: '#087E99', gap: 7,
    paddingHorizontal: 18, paddingVertical: 10, shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.14, shadowRadius: 11, elevation: 3 },
  refinedIcon: { width: 26, height: 26, backgroundColor: 'transparent' },
  refinedLabel: { flexShrink: 1, fontWeight: '700' },
  button: {
    minHeight: 52,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 22,
    ...shadows.button,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 16,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.5,
  },
});
