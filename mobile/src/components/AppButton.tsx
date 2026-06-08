import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
}

export function AppButton({ label, onPress, variant = 'primary' }: AppButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }: { pressed: boolean }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    borderRadius: radius.round,
    paddingHorizontal: spacing.lg,
  },
  primary: {
    backgroundColor: colors.primary,
    ...shadows.button,
  },
  secondary: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
  },
  label: {
    fontFamily: typography.fontFamily,
    fontSize: 17,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  primaryLabel: {
    color: colors.white,
  },
  secondaryLabel: {
    color: colors.primaryDark,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
