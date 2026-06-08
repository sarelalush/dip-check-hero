import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { AppInput } from '../components/AppInput';
import { AuthCard } from '../components/AuthCard';
import { Header } from '../components/Header';
import { PasswordInput } from '../components/PasswordInput';
import { Screen } from '../components/Screen';
import { colors, rtl, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!email.trim()) {
      setError('יש להזין אימייל כדי להמשיך.');
      return;
    }
    if (!password.trim()) {
      setError('יש להזין סיסמה כדי להמשיך.');
      return;
    }
    setError('');
    navigation.replace('Dashboard');
  }

  return (
    <Screen>
      <Header />
      <View style={styles.wrap}>
        <AuthCard
          eyebrow="התחברות"
          title="ברוכים השבים"
          subtitle="הכניסו אימייל וסיסמה. בשלב הזה זהו טופס מקומי בלבד, בלי חיבור לשרת."
        >
          <AppInput
            keyboardType="email-address"
            label="אימייל"
            onChangeText={setEmail}
            placeholder="name@example.com"
            value={email}
          />
          <PasswordInput
            label="סיסמה"
            onChangeText={setPassword}
            placeholder="הסיסמה שלך"
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="כניסה" onPress={submit} />
          <Pressable onPress={() => navigation.navigate('Signup')} style={styles.switchLink}>
            <Text style={styles.switchText}>אין לכם חשבון? הרשמה</Text>
          </Pressable>
        </AuthCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.xxl,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    ...rtl.text,
  },
  switchLink: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  switchText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.textCenter,
  },
});
