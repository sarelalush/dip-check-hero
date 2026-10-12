import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rtl, typography } from '../theme';
import { LineIcon } from './LineIcon';

export function DisclosureSection({
  title,
  summary,
  children,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <LineIcon
          name={expanded ? 'chevronUp' : 'chevronDown'}
          color={colors.primaryDeep}
          size={18}
        />
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 20,
    overflow: 'hidden',
  },
  header: {
    ...rtl.row,
    alignItems: 'center',
    gap: 12,
    padding: 16,
    minHeight: 56,
  },
  copy: { flex: 1, gap: 4 },
  title: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.text,
    ...rtl.text,
  },
  summary: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSoft,
    ...rtl.text,
  },
  body: {
    padding: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.borderSoft,
    gap: 10,
  },
  pressed: { backgroundColor: colors.backgroundSoft },
});
