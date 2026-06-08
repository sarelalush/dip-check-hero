import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, rtl, spacing, typography } from '../theme';

interface PasswordInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}

export function PasswordInput({ label, value, onChangeText, placeholder }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Pressable onPress={() => setVisible((next) => !next)} style={styles.toggle}>
          <Text style={styles.toggleText}>{visible ? 'הסתר' : 'הצג'}</Text>
        </Pressable>
        <TextInput
          autoCapitalize="none"
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          secureTextEntry={!visible}
          style={styles.input}
          textAlign="right"
          value={value}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
    ...rtl.text,
  },
  inputWrap: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 54,
    paddingLeft: spacing.sm,
    paddingRight: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
  toggle: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toggleText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
});
