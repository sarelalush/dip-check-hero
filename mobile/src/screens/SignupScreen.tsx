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
import { LineIcon } from '../components/LineIcon';
import { colors, rtl, typography } from '../theme';
import { useAuth } from '../state/AuthContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

const TERMS_VERSION = '2026-08-12';
const PRIVACY_POLICY_VERSION = '2026-08-12';

export function SignupScreen({ navigation }: Props) {
  const { isGuest, signInWithApple, signInWithGoogle, signUpWithEmail } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);

  function getLegalConsent() {
    return {
      acceptedAt: new Date().toISOString(),
      privacyPolicyVersion: PRIVACY_POLICY_VERSION,
      termsVersion: TERMS_VERSION,
    };
  }

  function requireLegalConsent() {
    if (legalAccepted) return true;
    setError('יש לאשר את תנאי השימוש ומדיניות הפרטיות כדי להירשם.');
    return false;
  }

  async function submit() {
    const phoneClean = phone.trim().replace(/\s+/g, '');

    if (!requireLegalConsent()) return;
    if (!name.trim()) return setError('יש להזין שם מלא כדי ליצור חשבון.');
    if (!email.trim()) return setError('יש להזין אימייל כדי ליצור חשבון.');
    if (!phoneClean) return setError('יש להזין מספר טלפון כדי ליצור חשבון.');
    if (!/^0\d{1,2}-?\d{7}$|^\+?\d{9,15}$/.test(phoneClean)) return setError('יש להזין מספר טלפון תקין.');
    if (!isGuest && password.length < 6) return setError('הסיסמה חייבת להכיל לפחות 6 תווים.');

    setBusy(true);
    setError('');
    setSuccess('');
    const result = await signUpWithEmail(email, password, name, phoneClean, getLegalConsent());
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess(result.requiresPasswordSetup
      ? 'נשלח אליכם אימייל לאימות. לאחר האישור תוכלו לבחור סיסמה דרך "שכחתי סיסמה" ולהשתמש ברכישה גם במכשירים נוספים.'
      : 'נשלח אליכם אימייל לאימות. לאחר האישור תוכלו להתחבר.');
    setTimeout(() => navigation.navigate('Login'), result.requiresPasswordSetup ? 4500 : 2200);
  }

  async function google() {
    if (!requireLegalConsent()) return;
    setGoogleBusy(true);
    setError('');
    setSuccess('');
    const result = await signInWithGoogle(getLegalConsent());
    setGoogleBusy(false);

    if (result.error) {
      setError(result.error);
    }
  }

  async function apple() {
    if (busy || appleBusy || googleBusy) return;
    if (!requireLegalConsent()) return;
    setAppleBusy(true);
    setError('');
    setSuccess('');
    const result = await signInWithApple(getLegalConsent());
    setAppleBusy(false);

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
      subtitle={isGuest ? 'הרשמה אופציונלית מאפשרת להשתמש ברכישות גם במכשירים נוספים' : 'צור חשבון כדי להתחיל לשמור על הבריכה שלך'}
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
      {!isGuest ? <AuthField compact icon="lock" label="סיסמה" onChangeText={setPassword} onSideIconPress={() => setPasswordVisible((visible) => !visible)} placeholder="בחר סיסמה" secure={!passwordVisible} sideIcon="eye" value={password} /> : null}

      <View style={styles.legalRow}>
        <Pressable
          accessibilityLabel="אישור תנאי השימוש ומדיניות הפרטיות"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: legalAccepted }}
          hitSlop={8}
          onPress={() => {
            setLegalAccepted((accepted) => !accepted);
            setError('');
          }}
          style={[styles.checkbox, legalAccepted && styles.checkboxChecked]}
        >
          {legalAccepted ? <LineIcon color={colors.white} name="check" size={16} /> : null}
        </Pressable>
        <Text style={styles.legalText}>
          קראתי ואני מסכים/ה ל
          <Text onPress={() => navigation.navigate('Terms')} style={styles.legalLink}>תנאי השימוש</Text>
          {' ול'}
          <Text onPress={() => navigation.navigate('PrivacyPolicy')} style={styles.legalLink}>מדיניות הפרטיות</Text>
        </Text>
      </View>

      <AuthMessage text={error} tone="error" />
      <AuthMessage text={success} tone="success" />

      <AuthPrimaryButton compact busy={busy} disabled={appleBusy || googleBusy} label={isGuest ? 'שלח קישור הרשמה' : 'הרשמה'} onPress={submit} />
      {!isGuest ? <AuthDivider compact /> : null}
      {!isGuest && Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          cornerRadius={11}
          onPress={apple}
          style={[styles.appleButton, (busy || appleBusy || googleBusy) && styles.disabled]}
        />
      ) : null}
      {!isGuest ? <SocialButton compact disabled={busy || appleBusy || googleBusy} label={googleBusy ? 'מתחבר עם Google...' : 'המשך עם Google'} mark="google" onPress={google} /> : null}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  appleButton: { height: 39, width: '100%' },
  disabled: { opacity: 0.62 },
  accountRow: { marginTop: Platform.OS === 'android' ? 8 : 2, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  accountText: { color: '#1D2530', fontFamily: typography.fontFamilyRegular, fontSize: 13, fontWeight: '700' },
  accountLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', ...rtl.text },
  legalRow: { alignItems: 'center', flexDirection: 'row-reverse', gap: 10, marginVertical: 4, width: '100%' },
  checkbox: { alignItems: 'center', borderColor: colors.primary, borderRadius: 5, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  checkboxChecked: { backgroundColor: colors.primary },
  legalText: { color: '#34495E', flex: 1, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  legalLink: { color: colors.primary, fontFamily: typography.fontFamilySemiBold, fontWeight: '800', textDecorationLine: 'underline' },
});
