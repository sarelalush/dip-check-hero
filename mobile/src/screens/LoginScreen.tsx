import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
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

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const { signInWithApple, signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
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

  async function apple() {
    if (busy || appleBusy || googleBusy) return;
    setAppleBusy(true);
    setError('');
    const result = await signInWithApple();
    setAppleBusy(false);

    if (result.error) {
      setError(result.error);
    }
  }

  return (
    <AuthScreenShell
      activeMode="login"
      noScroll
      onLoginTab={() => undefined}
      onSignupTab={() => navigation.navigate('Signup')}
      title="ברוך הבא"
      subtitle="התחבר כדי לראות את הבריכות והבדיקות שלך"
      footer={
        <>
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>אין לך חשבון?</Text>
            <Pressable onPress={() => navigation.navigate('Signup')}>
              <Text style={styles.accountLink}>צור חשבון</Text>
            </Pressable>
          </View>
          <SecureDataNote compact />
        </>
      }
    >
      <AuthField compact icon="mail" keyboardType="email-address" label="אימייל" onChangeText={setEmail} placeholder="הכנס כתובת אימייל" value={email} />
      <AuthField compact icon="lock" label="סיסמה" onChangeText={setPassword} onSideIconPress={() => setPasswordVisible((visible) => !visible)} placeholder="הכנס סיסמה" secure={!passwordVisible} sideIcon="eye" value={password} />

      <Pressable onPress={() => navigation.navigate('ForgotPassword')} style={styles.forgotButton}>
        <Text style={styles.forgotText}>שכחתי סיסמה</Text>
      </Pressable>

      <AuthMessage text={error} tone="error" />

      <AuthPrimaryButton compact busy={busy} disabled={appleBusy || googleBusy} label="התחברות" onPress={submit} />
      <AuthDivider compact />
      {Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          cornerRadius={11}
          onPress={apple}
          style={[styles.appleButton, (busy || appleBusy || googleBusy) && styles.disabled]}
        />
      ) : null}
      <SocialButton compact disabled={busy || appleBusy || googleBusy} label={googleBusy ? 'מתחבר עם Google...' : 'המשך עם Google'} mark="google" onPress={google} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  appleButton: { height: 39, width: '100%' },
  disabled: { opacity: 0.62 },
  forgotButton: { alignSelf: 'flex-start', marginTop: Platform.OS === 'android' ? 1 : -1, marginBottom: Platform.OS === 'android' ? 3 : 0, paddingVertical: 2 },
  forgotText: { color: colors.primary, fontFamily: typography.fontFamilyRegular, fontSize: 14, fontWeight: '700', ...rtl.text },
  accountRow: { marginTop: Platform.OS === 'android' ? 8 : 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  accountText: { color: '#1D2530', fontFamily: typography.fontFamilyRegular, fontSize: 13, fontWeight: '700' },
  accountLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900' },
});
