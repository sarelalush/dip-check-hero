import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import type { Pool } from '../domain/pool';
import { colors, rtl, typography } from '../theme';

export function PoolPicker({
  pools,
  selectedId,
  onSelect,
  includeAll = false,
}: {
  pools: Pool[];
  selectedId?: string;
  onSelect: (id: string | undefined) => void;
  includeAll?: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const alignToRight = () => scrollRef.current?.scrollToEnd({ animated: false });

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      style={styles.scroll}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      onContentSizeChange={alignToRight}
      onLayout={alignToRight}
    >
      {(includeAll ? [{ id: undefined, name: 'כל הבריכות' }, ...pools] : pools).map((pool) => (
        <Pressable
          key={pool.id ?? 'all'}
          accessibilityRole="button"
          accessibilityState={{ selected: pool.id === selectedId }}
          onPress={() => onSelect(pool.id)}
          style={[styles.pill, pool.id === selectedId && styles.selected]}
        >
          <Text style={[styles.text, pool.id === selectedId && styles.selectedText]}>
            {pool.name}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  scroll: { alignSelf: 'stretch', flexGrow: 0 },
  row: {
    ...rtl.row,
    flexGrow: 1,
    justifyContent: 'flex-start',
    gap: 8,
    paddingVertical: 8,
  },
  pill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  selected: { backgroundColor: colors.primaryDeep, borderColor: colors.primaryDeep },
  text: {
    fontFamily: typography.fontFamilySemiBold,
    color: colors.text,
    fontSize: 13,
    ...rtl.textCenter,
  },
  selectedText: { color: colors.white },
});
