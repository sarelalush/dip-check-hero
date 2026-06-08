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

type Props = NativeStackScreenProps<RootStackParamList, 'Signup'>;

export function SignupScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function submit() {
    if (!email.trim()) {
      setError('יש להזין אימייל כדי ליצור חשבון.');
      return;
    }
    if (!password.trim()) {
      setError('יש להזין סיסמה כדי ליצור חשבון.');
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
          eyebrow="הרשמה"
          title="מתחילים לשמור על המים"
          subtitle="נכין לכם מקום אישי לבריכות, סריקות והיסטוריה. החיבור האמיתי יתווסף בשלב הבא."
        >
          <AppInput
            label="שם לתצוגה"
            onChangeText={setName}
            placeholder="ישראל ישראלי"
            value={name}
          />
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
            placeholder="בחרו סיסמה"
            value={password}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <AppButton label="יצירת חשבון" onPress={submit} />
          <Pressable onPress={() => navigation.navigate('Login')} style={styles.switchLink}>
            <Text style={styles.switchText}>כבר יש לכם חשבון? התחברות</Text>
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
