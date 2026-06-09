import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, shadows, spacing } from '../theme';

interface CardProps {
  children: ReactNode;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, compact = false, style }: CardProps) {
  return <View style={[styles.card, compact && styles.compact, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.card,
  },
  compact: {
    borderRadius: 16,
    padding: spacing.md,
    ...shadows.soft,
  },
});
