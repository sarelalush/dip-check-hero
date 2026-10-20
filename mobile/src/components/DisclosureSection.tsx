import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, rtl, typography } from '../theme';
import { LineIcon } from './LineIcon';

export function DisclosureSection({
  title,
  summary,
  children,
  variant = 'default',
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  variant?: 'default' | 'quiet';
}) {
  const [expanded, setExpanded] = useState(false);
  const quiet = variant === 'quiet';

  return (
    <View style={[styles.section, quiet && styles.quietSection]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.header, quiet && styles.quietHeader, pressed && styles.pressed]}
      >
        <View style={styles.copy}>
          <Text style={[styles.title, quiet && styles.quietTitle]}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <View style={quiet ? styles.quietChevron : undefined}>
          <LineIcon name={expanded ? 'chevronUp' : 'chevronDown'} color={colors.primaryDeep} size={quiet ? 13 : 18} />
        </View>
      </Pressable>
      {expanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  quietSection: { borderRadius: 18, borderColor: '#E0EDF2' },
  quietHeader: { minHeight: 52, paddingHorizontal: 14, paddingVertical: 12 },
  quietTitle: { fontSize: 13 },
  quietChevron: { width: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F8FA' },
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
