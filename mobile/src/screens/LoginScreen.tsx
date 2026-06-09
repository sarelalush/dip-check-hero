import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';
import { useAuth } from '../state/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return setError('יש להזין אימייל כדי להמשיך.');
    if (!password.trim()) return setError('יש להזין סיסמה כדי להמשיך.');

    setBusy(true);
    setError('');
    const result = await signInWithEmail(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
    }
  }

  async function google() {
    setGoogleBusy(true);
    setError('');
    const result = await signInWithGoogle();
    setGoogleBusy(false);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.brandRow}>
          <Text style={styles.brandName}>AquaSense</Text>
          <View style={styles.brandDot}><Text style={styles.brandGlyph}>💧</Text></View>
        </View>

        <View style={styles.card}>
          <Text style={styles.eyebrow}>התחברות</Text>
          <Text style={styles.title}>ברוכים השבים</Text>
          <Text style={styles.subtitle}>היכנס כדי להמשיך לנטר את הבריכה שלך.</Text>

          <Field label="אימייל" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
          <Field label="סיסמה" value={password} onChangeText={setPassword} placeholder="הסיסמה שלך" secure />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable disabled={busy || googleBusy} onPress={submit} style={({ pressed }) => [styles.primaryBtn, (busy || googleBusy) && styles.disabled, pressed && { opacity: 0.9 }]}>
            <Text style={styles.primaryBtnLabel}>{busy ? 'מתחבר...' : 'כניסה'}</Text>
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>או</Text>
            <View style={styles.dividerLine} />
          </View>

          <Pressable disabled={busy || googleBusy} onPress={google} style={({ pressed }) => [styles.googleBtn, (busy || googleBusy) && styles.disabled, pressed && { opacity: 0.9 }]}>
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.googleLabel}>{googleBusy ? 'מתחבר עם Google...' : 'התחברות עם Google'}</Text>
          </Pressable>

          <Pressable onPress={() => navigation.navigate('Signup')} style={styles.linkBtn}>
            <Text style={styles.linkText}>אין לכם חשבון? הרשמה ‹</Text>
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
  title: { fontSize: 26, fontWeight: '900', color: colors.text, ...rtl.text, fontFamily: typography.fontFamily },
  subtitle: { fontSize: 13, fontWeight: '600', color: colors.muted, ...rtl.text, lineHeight: 20, fontFamily: typography.fontFamily },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 4, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', ...shadows.button },
  primaryBtnLabel: { color: colors.white, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily },
  dividerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginVertical: 2 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderSoft },
  dividerText: { color: colors.muted, fontSize: 12, fontWeight: '800', fontFamily: typography.fontFamily },
  googleBtn: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  googleMark: { color: '#4285F4', fontSize: 17, fontWeight: '900', fontFamily: typography.fontFamilyBold },
  googleLabel: { color: colors.text, fontSize: 14, fontWeight: '900', fontFamily: typography.fontFamily },
  disabled: { opacity: 0.62 },
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
