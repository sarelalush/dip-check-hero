import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, shadows, typography } from '../theme';
import { LineIcon, type LineIconName } from './LineIcon';

interface PrimaryButtonProps {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  icon?: LineIconName;
  onPress?: () => void;
}

export function PrimaryButton({ busy = false, disabled = false, label, icon, onPress }: PrimaryButtonProps) {
  const isDisabled = disabled || busy;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, isDisabled && styles.disabled, pressed && !isDisabled && styles.pressed]}
    >
      {busy ? (
        <View style={styles.icon}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      ) : icon ? (
        <View style={styles.icon}>
          <LineIcon name={icon} color={colors.primary} size={18} />
        </View>
      ) : null}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
