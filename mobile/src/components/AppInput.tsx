import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { colors, radius, rtl, spacing, typography } from '../theme';

interface AppInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  secureTextEntry?: boolean;
}

export function AppInput({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  secureTextEntry = false,
}: AppInputProps) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        autoCapitalize="none"
        keyboardType={keyboardType}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        textAlign="right"
        value={value}
      />
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
  input: {
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    minHeight: 54,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    writingDirection: 'rtl',
  },
});
