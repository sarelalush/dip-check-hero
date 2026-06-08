import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!email.trim()) return setError('יש להזין אימייל כדי ליצור חשבון.');
    if (!password.trim()) return setError('יש להזין סיסמה כדי ליצור חשבון.');
    setError('');
    navigation.replace('Dashboard');
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>AquaSense</Text>
          <View style={styles.brandDot}><Text style={styles.brandGlyph}>💧</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>הרשמה</Text>
          <Text style={styles.title}>מתחילים לשמור{'\n'}על המים</Text>
          <Text style={styles.subtitle}>נכין לך מקום אישי לבריכות, סריקות והיסטוריה.</Text>

          <Field label="שם לתצוגה" value={name} onChangeText={setName} placeholder="ישראל ישראלי" />
          <Field label="אימייל" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
          <Field label="סיסמה" value={password} onChangeText={setPassword} placeholder="בחר סיסמה" secure />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable onPress={submit} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.primaryBtnLabel}>יצירת חשבון</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>כבר יש לכם חשבון? התחברות ‹</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, secure }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'email-address'; secure?: boolean;
}) {
  return (
    <View style={fieldStyles.wrap}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={fieldStyles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        secureTextEntry={secure}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  brandRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10 },
  brandName: { color: colors.primary, fontSize: 18, fontWeight: '900', letterSpacing: 0.5, fontFamily: typography.fontFamily },
  brandDot: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  brandGlyph: { fontSize: 18 },
  card: { marginTop: 24, backgroundColor: colors.card, borderRadius: 28, padding: 22, gap: 14, ...shadows.card },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.6, ...rtl.text, fontFamily: typography.fontFamily },
  title: { fontSize: 26, fontWeight: '900', color: colors.text, ...rtl.text, lineHeight: 34, fontFamily: typography.fontFamily },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.muted, ...rtl.text, lineHeight: 20, fontFamily: typography.fontFamily },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 4, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', ...shadows.button },
  primaryBtnLabel: { color: colors.white, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily },
  linkBtn: { alignItems: 'center', paddingVertical: 4 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamily },
});

const fieldStyles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  input: {
    backgroundColor: '#F5FAFD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    textAlign: 'right', writingDirection: 'rtl', fontFamily: typography.fontFamily,
  },
});
