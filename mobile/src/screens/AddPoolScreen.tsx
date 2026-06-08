import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppButton } from '../components/AppButton';
import { AppInput } from '../components/AppInput';
import { Card } from '../components/Card';
import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { colors, radius, rtl, spacing, typography } from '../theme';
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
    if (!name.trim()) {
      setError('יש להזין שם לבריכה.');
      return;
    }
    if (lengthMeters <= 0 || widthMeters <= 0 || averageDepthMeters <= 0) {
      setError('יש להזין אורך, רוחב ועומק ממוצע גדולים מאפס.');
      return;
    }

    addPool({
      averageDepthMeters,
      lengthMeters,
      name: name.trim(),
      notes: notes.trim() || undefined,
      shape: 'rectangle',
      volumeLiters,
      widthMeters,
    });
    setError('');
    navigation.navigate('PoolsList');
  }

  return (
    <Screen>
      <Header />
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>בריכה חדשה</Text>
        <Text style={styles.title}>הוספת פרטי בריכה</Text>
        <Text style={styles.subtitle}>
          כרגע נתמכת בריכה מלבנית בלבד. הנפח מחושב לפי אורך × רוחב × עומק ממוצע × 1000.
        </Text>
      </View>

      <View style={styles.form}>
        <AppInput
          label="שם הבריכה"
          onChangeText={setName}
          placeholder="למשל: הבריכה בבית"
          value={name}
        />

        <Card style={styles.shapeCard}>
          <Text style={styles.shapeLabel}>צורת בריכה</Text>
          <Text style={styles.shapeValue}>מלבנית</Text>
        </Card>

        <View style={styles.measureGrid}>
          <View style={styles.measureInput}>
            <AppInput
              keyboardType="decimal-pad"
              label="אורך במטרים"
              onChangeText={setLength}
              placeholder="8"
              value={length}
            />
          </View>
          <View style={styles.measureInput}>
            <AppInput
              keyboardType="decimal-pad"
              label="רוחב במטרים"
              onChangeText={setWidth}
              placeholder="4"
              value={width}
            />
          </View>
        </View>

        <AppInput
          keyboardType="decimal-pad"
          label="עומק ממוצע במטרים"
          onChangeText={setAverageDepth}
          placeholder="1.5"
          value={averageDepth}
        />

        <Card style={styles.volumeCard}>
          <Text style={styles.volumeLabel}>נפח מחושב</Text>
          <Text style={styles.volumeValue}>
            {volumeLiters > 0 ? volumeLiters.toLocaleString('he-IL') : '0'} ליטר
          </Text>
        </Card>

        <AppInput
          label="הערות אופציונליות"
          multiline
          onChangeText={setNotes}
          placeholder="למשל: כיסוי, שמש ישירה, משאבה פעילה..."
          value={notes}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AppButton label="שמירת בריכה" onPress={save} />
        <AppButton label="ביטול" variant="secondary" onPress={() => navigation.navigate('PoolsList')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: spacing.xxl,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.caption,
    fontWeight: '900',
    letterSpacing: typography.brandSpacing,
    ...rtl.text,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamily,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.sizes.body,
    fontWeight: '600',
    lineHeight: typography.lineHeights.body,
    marginTop: spacing.sm,
    ...rtl.text,
  },
  form: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  shapeCard: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  shapeLabel: {
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  shapeValue: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.round,
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 14,
    fontWeight: '900',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...rtl.textCenter,
  },
  measureGrid: {
    flexDirection: 'row-reverse',
    gap: spacing.md,
  },
  measureInput: {
    flex: 1,
  },
  volumeCard: {
    backgroundColor: colors.primarySoft,
    borderColor: '#BDECF6',
  },
  volumeLabel: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    ...rtl.text,
  },
  volumeValue: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamily,
    fontSize: 26,
    fontWeight: '900',
    marginTop: spacing.xs,
    ...rtl.text,
  },
  error: {
    color: colors.danger,
    fontFamily: typography.fontFamily,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    ...rtl.text,
  },
});
