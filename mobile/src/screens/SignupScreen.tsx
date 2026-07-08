import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AuthDivider,
  AuthField,
  AuthMessage,
  AuthPrimaryButton,
  AuthScreenShell,
  SecureDataNote,
  SocialButton,
} from '../components/AuthScreenShell';
import { colors, rtl, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function submit() {
    const phoneClean = phone.trim().replace(/\s+/g, '');

    if (!name.trim()) return setError('יש להזין שם מלא כדי ליצור חשבון.');
    if (!email.trim()) return setError('יש להזין אימייל כדי ליצור חשבון.');
    if (!phoneClean) return setError('יש להזין מספר טלפון כדי ליצור חשבון.');
    if (!/^0\d{1,2}-?\d{7}$|^\+?\d{9,15}$/.test(phoneClean)) return setError('יש להזין מספר טלפון תקין.');
    if (password.length < 6) return setError('הסיסמה חייבת להכיל לפחות 6 תווים.');

    setBusy(true);
    setError('');
    setSuccess('');
    const result = await signUpWithEmail(email, password, name, phoneClean);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess('נשלח אליכם אימייל לאימות. לאחר האישור תוכלו להתחבר.');
    setTimeout(() => navigation.navigate('Login'), 2200);
  }

  async function google() {
    setGoogleBusy(true);
    setError('');
    setSuccess('');
    const result = await signInWithGoogle();
    setGoogleBusy(false);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <AuthScreenShell
      activeMode="signup"
      noScroll
      onLoginTab={() => navigation.navigate('Login')}
      onSignupTab={() => undefined}
      title="ברוך הבא"
      subtitle="צור חשבון כדי להתחיל לשמור על הבריכה שלך"
      footer={
        <>
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>יש לך חשבון?</Text>
            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.accountLink}>התחבר</Text>
            </Pressable>
          </View>
          <SecureDataNote compact />
        </>
      }
    >
      <AuthField compact icon="user" label="שם מלא" onChangeText={setName} placeholder="הכנס שם מלא" value={name} />
      <AuthField compact icon="user" keyboardType="phone-pad" label="טלפון" onChangeText={setPhone} placeholder="050..." value={phone} />
      <AuthField compact icon="mail" keyboardType="email-address" label="אימייל" onChangeText={setEmail} placeholder="הכנס כתובת אימייל" value={email} />
      <AuthField compact icon="lock" label="סיסמה" onChangeText={setPassword} placeholder="בחר סיסמה" secure sideIcon="eye" value={password} />

      <AuthMessage text={error} tone="error" />
      <AuthMessage text={success} tone="success" />

      <AuthPrimaryButton compact busy={busy} disabled={googleBusy} label="הרשמה" onPress={submit} />
      <AuthDivider compact />
      {Platform.OS === 'ios' ? (
        <SocialButton compact disabled={busy || googleBusy} label="המשך עם Apple" mark="apple" onPress={() => setError('הרשמה עם Apple תהיה זמינה בקרוב.')} />
      ) : null}
      <SocialButton compact disabled={busy || googleBusy} label={googleBusy ? 'מתחבר עם Google...' : 'המשך עם Google'} mark="google" onPress={google} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  accountRow: { marginTop: -1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  accountText: { color: '#1D2530', fontFamily: typography.fontFamilyRegular, fontSize: 13, fontWeight: '700' },
  accountLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', ...rtl.text },
});
