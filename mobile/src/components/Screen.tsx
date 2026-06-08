import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { colors, spacing } from '../theme';

interface ScreenProps {
  children: ReactNode;
}

export function Screen({ children }: ScreenProps) {
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: 58,
  },
});
