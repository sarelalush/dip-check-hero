import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { colors, radius } from '../theme';

type Mode = 'login' | 'signup';

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('חסר מידע', 'צריך להזין אימייל וסיסמה');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.trim() },
          },
        });
        if (error) throw error;
        Alert.alert('נרשמת בהצלחה', 'בדוק את האימייל אם נדרש אישור חשבון');
      }
    } catch (error) {
      Alert.alert('שגיאה', error instanceof Error ? error.message : 'נסיון הכניסה נכשל');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.kicker}>AQUASENSE</Text>
        <Text style={styles.title}>בדיקת מים לבריכה</Text>
        <Text style={styles.subtitle}>התחבר כדי לסרוק סטיק בדיקה ולשמור היסטוריה.</Text>

        {mode === 'signup' ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="שם להצגה"
            placeholderTextColor={colors.muted}
            textAlign="right"
            style={styles.input}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="אימייל"
          placeholderTextColor={colors.muted}
          textAlign="right"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="סיסמה"
          placeholderTextColor={colors.muted}
          textAlign="right"
          style={styles.input}
        />

        <Pressable disabled={loading} onPress={submit} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
          <Text style={styles.primaryButtonText}>{loading ? 'טוען...' : mode === 'login' ? 'כניסה' : 'הרשמה'}</Text>
        </Pressable>

        <Pressable onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchButton}>
          <Text style={styles.switchText}>{mode === 'login' ? 'אין לך חשבון? הרשמה' : 'כבר יש חשבון? כניסה'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  kicker: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'right',
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 22,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: '800',
  },
  switchButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  switchText: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
});
