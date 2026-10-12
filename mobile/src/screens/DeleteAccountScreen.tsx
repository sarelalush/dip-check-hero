import { useState } from 'react';
import { ImageBackground, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { useAuth } from '../state/AuthContext';
import { getSupabaseClient } from '../integrations/supabase/client';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'DeleteAccount'>;
const DELETE_ACCOUNT_URL = 'https://sarelalush.github.io/dip-check-hero/delete-account/';
const DELETE_POOL_IMAGE = require('../../assets/images/home-pool.png');

export function DeleteAccountScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState('');
  const canRequestDeletion = confirmation.trim() === 'מחיקה';

  async function requestDeletion() {
    if (busy || requestId) return;
    if (!canRequestDeletion) {
      setMessage('כדי להמשיך יש להקליד את המילה מחיקה.');
      return;
    }

    setBusy(true); setMessage('');
    try {
      const { data, error } = await getSupabaseClient().rpc('request_account_deletion', {
        p_confirmation: confirmation.trim(),
      });
      const result = data as { id?: string; status?: string } | null;
      if (error || !result?.id) throw new Error('לא ניתן לשלוח בקשה כרגע. נסה שוב או פנה לתמיכה.');
      setRequestId(result.id);
      setMessage('הבקשה נרשמה בשרת. מספר פנייה: ' + result.id +
        '. החשבון עדיין לא נמחק. נעדכן לאחר ביצוע המחיקה; לפנייה על סטטוס: support@dipcheck.app.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'הבקשה לא נשלחה. נסה שוב.');
    } finally { setBusy(false); }
  }

  async function openDeletionPage() {
    const canOpen = await Linking.canOpenURL(DELETE_ACCOUNT_URL);

    if (canOpen) {
      await Linking.openURL(DELETE_ACCOUNT_URL);
      return;
    }

    setMessage(`אפשר להגיש בקשת מחיקה בקישור: ${DELETE_ACCOUNT_URL}`);
  }

  return (
    <ImageBackground source={DELETE_POOL_IMAGE} resizeMode="cover" style={styles.root}>
      <View style={styles.waterWash} />
      <View style={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" accessibilityLabel="חזרה" onPress={() => navigation.goBack()} style={styles.iconButton}>
            <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>מחיקת חשבון</Text>
            <Text style={styles.subtitle}>{user?.email ?? 'חשבון משתמש'}</Text>
          </View>
        </View>

        <Card style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <LineIcon name="help" color={colors.danger} size={22} />
          </View>
          <Text style={styles.warningTitle}>פעולה רגישה</Text>
          <Text style={styles.warningText}>
            כאן אפשר להגיש בקשה למחיקת החשבון והמידע המשויך אליו. המחיקה עצמה אינה הפיכה; אישור קבלת הבקשה אינו אישור שהמחיקה בוצעה.
          </Text>
          <Text style={styles.explainText}>
            המידע שלך ייבחן בנפרד ממידע של משתמשים אחרים בחשבון משותף. מחיקת חשבון אינה מבטלת אוטומטית מנוי בחנות — יש לבדוק גם את ניהול המנוי.
          </Text>
        </Card>

        <Card compact style={styles.formCard}>
          <Text style={styles.fieldLabel}>להמשך הקלד: מחיקה</Text>
          <TextInput
            style={styles.input}
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="מחיקה"
            placeholderTextColor={colors.muted}
          />
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Pressable onPress={openDeletionPage} style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}>
            <Text style={styles.linkButtonText}>פתיחת עמוד מחיקת חשבון</Text>
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy || !canRequestDeletion || Boolean(requestId)} onPress={requestDeletion} style={({ pressed }) => [styles.dangerButton, (!canRequestDeletion || busy || Boolean(requestId)) && styles.disabled, pressed && styles.pressed]}>
            <Text style={styles.dangerButtonText}>{busy ? 'שולח בקשה...' : requestId ? 'הבקשה התקבלה' : 'שליחת בקשת מחיקת חשבון'}</Text>
          </Pressable>
        </Card>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  waterWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,253,255,0.72)' },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 44 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 22, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 4, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', ...rtl.text },
  warningCard: { marginTop: 20, alignItems: 'center', gap: 9 },
  warningIcon: { width: 58, height: 58, borderRadius: 25, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  warningTitle: { color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 18, fontWeight: '900', ...rtl.textCenter },
  warningText: { color: colors.danger, fontFamily: typography.fontFamilyBold, fontSize: 13, fontWeight: '900', lineHeight: 20, ...rtl.textCenter },
  explainText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 19, ...rtl.textCenter },
  formCard: { marginTop: 14, gap: 10 },
  fieldLabel: { color: colors.text, fontFamily: typography.fontFamilySemiBold, fontSize: 13, fontWeight: '900', ...rtl.text },
  input: { backgroundColor: '#F5FAFD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border, textAlign: 'right', writingDirection: 'rtl', fontFamily: typography.fontFamily },
  message: { color: colors.warning, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 18, ...rtl.text },
  linkButton: { borderRadius: radius.round, backgroundColor: colors.primarySoft, paddingVertical: 13, alignItems: 'center' },
  linkButtonText: { color: colors.primaryDark, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900' },
  dangerButton: { borderRadius: radius.round, backgroundColor: colors.danger, paddingVertical: 13, alignItems: 'center', ...shadows.soft },
  dangerButtonText: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
