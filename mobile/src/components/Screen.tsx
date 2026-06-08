import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { colors, layout, spacing } from '../theme';

interface ScreenProps {
  children: ReactNode;
}

export function Screen({ children }: ScreenProps) {
  return (
    <View style={styles.viewport}>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  root: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxPhoneWidth,
    backgroundColor: colors.background,
  },
  content: {
    minHeight: '100%',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: 58,
  },
});
