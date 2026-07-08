import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AuthField,
  AuthMessage,
  AuthPrimaryButton,
  AuthScreenShell,
  SecureDataNote,
} from '../components/AuthScreenShell';
import { colors, rtl, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ForgotPassword'>;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { resetPasswordForEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError('יש להזין אימייל כדי לשלוח קישור לאיפוס סיסמה.');
      setSuccess('');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');
    const result = await resetPasswordForEmail(cleanEmail);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('שלחנו אליך קישור לאיפוס הסיסמה. אם החשבון קיים, המייל יגיע בתוך כמה דקות.');
  }

  return (
    <AuthScreenShell
      activeMode="login"
      noScroll
      onLoginTab={() => navigation.navigate('Login')}
      onSignupTab={() => navigation.navigate('Signup')}
      title="איפוס סיסמה"
      subtitle="הכנס את האימייל שלך ונשלח קישור מאובטח לאיפוס"
      footer={
        <>
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>נזכרת בסיסמה?</Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.accountLink}>חזור להתחברות</Text>
            </Pressable>
          </View>
          <SecureDataNote compact />
        </>
      }
    >
      <AuthField compact icon="mail" keyboardType="email-address" label="אימייל" onChangeText={setEmail} placeholder="הכנס כתובת אימייל" value={email} />

      <Text style={styles.helperText}>נשלח קישור חד־פעמי לכתובת האימייל שמחוברת לחשבון שלך.</Text>

      <AuthMessage text={error} tone="error" />
      <AuthMessage text={success} tone="success" />

      <AuthPrimaryButton compact busy={busy} label="שלח קישור איפוס" onPress={submit} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: '#5F7081',
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: -2,
    ...rtl.text,
  },
  accountRow: { marginTop: 0, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  accountText: { color: '#1D2530', fontFamily: typography.fontFamilyRegular, fontSize: 13, fontWeight: '700' },
  accountLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', ...rtl.text },
});
