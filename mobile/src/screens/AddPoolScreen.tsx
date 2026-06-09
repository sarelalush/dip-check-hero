import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, rtl, shadows, typography } from '../theme';
import { calculateRectangularVolumeLiters, usePools } from '../state/PoolsContext';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPool'>;

function parseMeters(value: string) {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function AddPoolScreen({ navigation }: Props) {
  const { addPool } = usePools();
  const [name, setName] = useState('');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [averageDepth, setAverageDepth] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const lengthMeters = parseMeters(length);
  const widthMeters = parseMeters(width);
  const averageDepthMeters = parseMeters(averageDepth);

  const volumeLiters = useMemo(
    () => calculateRectangularVolumeLiters(lengthMeters, widthMeters, averageDepthMeters),
    [averageDepthMeters, lengthMeters, widthMeters],
  );

  function save() {
    if (!name.trim()) return setError('יש להזין שם לבריכה.');
    if (lengthMeters <= 0 || widthMeters <= 0 || averageDepthMeters <= 0) {
      return setError('יש להזין אורך, רוחב ועומק ממוצע גדולים מאפס.');
    }
    const pool = addPool({ averageDepthMeters, lengthMeters, name: name.trim(), notes: notes.trim() || undefined, shape: 'rectangle', volumeLiters, widthMeters });
    setError('');
    navigation.navigate('PoolDetails', { poolId: pool.id });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Pools')}>
            <Text style={styles.iconGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.heading}>בריכה חדשה</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <Field label="שם הבריכה" value={name} onChangeText={setName} placeholder="למשל: הבריכה בבית" />

          <View style={styles.shapeRow}>
            <Text style={styles.shapeLabel}>צורה</Text>
            <View style={styles.pill}><Text style={styles.pillText}>מלבנית</Text></View>
          </View>

          <View style={styles.grid}>
            <View style={{ flex: 1 }}>
              <Field label="אורך (מ')" value={length} onChangeText={setLength} placeholder="8" numeric />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="רוחב (מ')" value={width} onChangeText={setWidth} placeholder="4" numeric />
            </View>
          </View>

          <Field label="עומק ממוצע (מ')" value={averageDepth} onChangeText={setAverageDepth} placeholder="1.5" numeric />

          <View style={styles.volumeBox}>
            <Text style={styles.volumeLabel}>נפח מחושב</Text>
            <Text style={styles.volumeValue}>{volumeLiters > 0 ? volumeLiters.toLocaleString('he-IL') : '0'} ליטר</Text>
          </View>

          <Field label="הערות (אופציונלי)" value={notes} onChangeText={setNotes} placeholder="כיסוי, חשיפה לשמש, וכו'" multiline />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Pressable onPress={save} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }]}>
          <Text style={styles.primaryBtnLabel}>שמירת בריכה</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Pools')} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnLabel}>ביטול</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, placeholder, numeric, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; numeric?: boolean; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={numeric ? 'decimal-pad' : 'default'}
        multiline={multiline}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 40 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  iconGlyph: { fontSize: 24, color: colors.text, fontWeight: '900' },
  heading: { fontSize: 18, fontWeight: '900', color: colors.text, ...rtl.textCenter, flex: 1, fontFamily: typography.fontFamily },
  card: { backgroundColor: colors.card, borderRadius: 28, padding: 20, gap: 14, ...shadows.card },
  shapeRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  shapeLabel: { color: colors.muted, fontSize: 13, fontWeight: '800', fontFamily: typography.fontFamily },
  pill: { backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 },
  pillText: { color: colors.primaryDark, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamily },
  grid: { flexDirection: 'row-reverse', gap: 12 },
  volumeBox: { backgroundColor: '#ECFEFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#BDECF6' },
  volumeLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  volumeValue: { marginTop: 4, color: colors.primaryDark, fontSize: 22, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  primaryBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', ...shadows.button },
  primaryBtnLabel: { color: colors.white, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily },
  secondaryBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnLabel: { color: colors.muted, fontSize: 14, fontWeight: '800', fontFamily: typography.fontFamily },
});

const fieldStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  input: {
    backgroundColor: '#F5FAFD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    textAlign: 'right', writingDirection: 'rtl', fontFamily: typography.fontFamily,
  },
});
