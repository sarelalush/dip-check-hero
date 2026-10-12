import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, rtl, typography } from '../theme';
import { getBrand } from '../config/stripBrands';
import type { CaptureMetadata } from '../domain/captureQuality';
import { PrimaryButton } from './PrimaryButton';

interface Props {
  visible: boolean;
  brandId?: string;
  onClose: () => void;
  onPrepare: (timing: Omit<CaptureMetadata, 'source' | 'capturedAt'>) => void;
}

export function ScanPreparationSheet({ visible, brandId, onClose, onPrepare }: Props) {
  const [seconds, setSeconds] = useState('');
  const [error, setError] = useState('');
  const key = `@aquasense/read-delay:${brandId ?? 'unknown'}`;
  useEffect(() => {
    let active = true;
    setSeconds('');
    setError('');
    AsyncStorage.getItem(key)
      .then((value) => {
        if (active && value) setSeconds(value);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [key]);

  function startTimer() {
    const delay = Number(seconds);
    if (!/^\d{1,3}$/.test(seconds) || delay < 1 || delay > 300) {
      setError('הזן את מספר השניות שמופיע על האריזה (1–300).');
      return;
    }
    void AsyncStorage.setItem(key, seconds).catch(() => {});
    onPrepare({ timing: 'timer', dippedAt: Date.now(), readDelaySeconds: delay });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable
              accessibilityLabel="סגור הנחיות צילום"
              accessibilityRole="button"
              onPress={onClose}
              style={styles.close}
            >
              <Text style={styles.link}>סגור</Text>
            </Pressable>
            <Text style={styles.title}>מכינים צילום ברור</Text>
            <Text style={styles.brand}>{getBrand(brandId).nameHe}</Text>
            <Text style={styles.body}>
              1. הכן את המצלמה לפני הטבילה. השתמש בסטיק בתוקף וגע רק בידית, באצבעות יבשות.
            </Text>
            <Text style={styles.body}>
              2. טבול והוצא לפי ההוראות שעל האריזה. החזק את הסטיק במנח שהיצרן דורש, בלי לנגב את
              ריבועי הצבע.
            </Text>
            <Text style={styles.body}>
              3. צלם באור אחיד, ללא שמש ישירה, צל או השתקפות על הריבועים. הימנע מפלאש ומרקע צבעוני;
              העדף רקע ניטרלי מט.
            </Text>
            <Text style={styles.body}>
              4. שמור על סטיק אחד שלם בתוך המסגרת, כולל הריבועים והידית. החזק את הטלפון מקביל לסטיק.
              אם התמונה לא חדה, התרחק מעט ואפשר למצלמה להתמקד.
            </Text>
            <Text style={styles.label}>זמן ההמתנה שעל האריזה, בשניות</Text>
            <TextInput
              accessibilityLabel="זמן המתנה לפי אריזת הסטיק בשניות"
              value={seconds}
              onChangeText={(value) => {
                setSeconds(value.replace(/\D/g, '').slice(0, 3));
                setError('');
              }}
              keyboardType="number-pad"
              maxLength={3}
              placeholder="העתק מהאריזה"
              style={styles.input}
            />
            <Text style={styles.note}>
              הזמן נשמר לנוחותך. בדוק אותו שוב כשהאריזה או סוג הסטיק משתנים. לחץ ברגע שהוצאת את
              הסטיק מהמים.
            </Text>
            {error ? (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                {error}
              </Text>
            ) : null}
            <PrimaryButton label="הוצאתי מהמים — התחל טיימר" icon="history" onPress={startTimer} />
            <Pressable
              accessibilityRole="button"
              onPress={() => onPrepare({ timing: 'userConfirmed' })}
              style={styles.manual}
            >
              <Text style={styles.link}>כבר המתנתי לפי האריזה — המשך לצילום</Text>
            </Pressable>
            <Text style={styles.note}>
              אם חלון הקריאה שעל האריזה עבר, השתמש בסטיק חדש. צילום חד לבדו אינו מבטיח קריאה נכונה.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  content: { padding: 22, paddingBottom: 36, gap: 12 },
  close: { alignSelf: 'flex-end', padding: 10 },
  title: { fontFamily: typography.fontFamilyBold, fontSize: 24, color: colors.text, ...rtl.text },
  brand: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.primaryDark,
    ...rtl.text,
  },
  body: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 14,
    lineHeight: 23,
    color: colors.text,
    ...rtl.text,
  },
  label: { fontFamily: typography.fontFamilyBold, fontSize: 14, color: colors.text, ...rtl.text },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 14,
    padding: 14,
    fontSize: 17,
    color: colors.text,
    ...rtl.text,
  },
  note: {
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSoft,
    ...rtl.text,
  },
  manual: { paddingVertical: 12, minHeight: 44 },
  link: {
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    color: colors.primaryDeep,
    ...rtl.textCenter,
  },
  error: { color: colors.danger, fontFamily: typography.fontFamilyRegular, ...rtl.text },
});
