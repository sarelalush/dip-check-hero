import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';

interface AuthCardProps {
  children: ReactNode;
  eyebrow: string;
  title: string;
  subtitle: string;
}

export function AuthCard({ children, eyebrow, title, subtitle }: AuthCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows.card,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.text,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 38,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 23,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  body: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
});
