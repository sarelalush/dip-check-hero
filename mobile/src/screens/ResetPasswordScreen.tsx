import { useEffect, useMemo, useState } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'ResetPassword'>;

export function ResetPasswordScreen({ navigation }: Props) {
  const { clearPasswordRecovery, completePasswordReset, passwordRecoveryExpiresAt, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const timeLeft = useMemo(() => {
    if (!passwordRecoveryExpiresAt) return '00:00';
    const seconds = Math.max(0, Math.ceil((passwordRecoveryExpiresAt - now) / 1000));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, [now, passwordRecoveryExpiresAt]);
  const recoveryStillValid = Boolean(passwordRecoveryExpiresAt && now < passwordRecoveryExpiresAt);

  async function submit() {
    if (!recoveryStillValid) {
      setError('קישור האיפוס פג תוקף. יש לשלוח קישור חדש.');
      return;
    }
    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים.');
      return;
    }
    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות.');
      return;
    }

    setBusy(true);
    setError('');
    const result = await completePasswordReset(password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }

  async function backToLogin() {
    clearPasswordRecovery();
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  }

  async function requestNewLink() {
    clearPasswordRecovery();
    await signOut();
    navigation.reset({ index: 0, routes: [{ name: 'ForgotPassword' }] });
  }

  return (
    <AuthScreenShell
      activeMode="login"
      noScroll
      onLoginTab={backToLogin}
      onSignupTab={() => navigation.navigate('Signup')}
      title="איפוס סיסמה"
      subtitle="בחר סיסמה חדשה לחשבון שלך"
      footer={
        <>
          <View style={styles.accountRow}>
            <Text style={styles.accountText}>נזכרת בסיסמה?</Text>
            <Pressable onPress={backToLogin}>
              <Text style={styles.accountLink}>חזור להתחברות</Text>
            </Pressable>
          </View>
          <SecureDataNote compact />
        </>
      }
    >
      {recoveryStillValid ? (
        <>
          <Text style={styles.helperText}>הקישור מאובטח וזמין לעוד {timeLeft} דקות.</Text>
          <AuthField
            compact
            icon="lock"
            label="סיסמה חדשה"
            onChangeText={setPassword}
            onSideIconPress={() => setPasswordVisible((visible) => !visible)}
            placeholder="בחר סיסמה חדשה"
            secure={!passwordVisible}
            sideIcon="eye"
            value={password}
          />
          <AuthField
            compact
            icon="lock"
            label="אימות סיסמה"
            onChangeText={setConfirmPassword}
            onSideIconPress={() => setConfirmVisible((visible) => !visible)}
            placeholder="הקלד שוב את הסיסמה"
            secure={!confirmVisible}
            sideIcon="eye"
            value={confirmPassword}
          />
          <AuthMessage text={error} tone="error" />
          <AuthPrimaryButton compact busy={busy} label="שמור סיסמה חדשה" onPress={submit} />
        </>
      ) : (
        <>
          <Text style={styles.helperText}>קישור האיפוס חסר או פג תוקף. כדי להגן על החשבון, יש לשלוח קישור חדש מהמייל שלך.</Text>
          <AuthMessage text={error} tone="error" />
          <AuthPrimaryButton compact label="שלח קישור חדש" onPress={requestNewLink} />
        </>
      )}
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
    ...rtl.text,
  },
  accountRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 8 },
  accountText: { color: '#1D2530', fontFamily: typography.fontFamilyRegular, fontSize: 13, fontWeight: '700' },
  accountLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', ...rtl.text },
});
