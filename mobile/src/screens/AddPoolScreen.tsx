import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { getRecommendedBrand } from '../config/stripBrands';
import { WebPhoneFrame } from '../components/WebPhoneFrame';
import {
  calculateManualVolumeLiters,
  calculatePoolVolume,
  type PoolShape,
  type PoolType,
  type PoolVolumeEntryMethod,
  type PoolVolumeUnit,
} from '../domain/pool';
import { colors, rtl, shadows, typography } from '../theme';
import { usePools } from '../state/PoolsContext';
import { useAuth } from '../state/AuthContext';
import { canCreatePool, hasActiveSubscription } from '../services/usageService';
import { normalizeNumericInput, parseNumberInput } from '../utils/numberInput';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'AddPool'>;
type TabletsChoice = 'yes' | 'no' | 'unknown';
const ADD_POOL_IMAGE = require('../../assets/images/home-pool.png');

export function AddPoolScreen({ navigation }: Props) {
  const { addPool, pools } = usePools();
  const { accountId } = useAuth();
  const recommendedBrand = getRecommendedBrand();
  const [name, setName] = useState('');
  const [type, setType] = useState<PoolType>('chlorine');
  const [method, setMethod] = useState<PoolVolumeEntryMethod>('manual');
  const [unit, setUnit] = useState<PoolVolumeUnit>('liters');
  const [manualVolume, setManualVolume] = useState('');
  const [shape, setShape] = useState<PoolShape>('rectangle');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [diameter, setDiameter] = useState('');
  const [averageDepth, setAverageDepth] = useState('');
  const [tabletsChoice, setTabletsChoice] = useState<TabletsChoice>('unknown');
  const [tabletsCount, setTabletsCount] = useState('1');
  const [tabletWeight, setTabletWeight] = useState('200');
  const [pumpHoursPerDay, setPumpHoursPerDay] = useState('8');
  const [retestHours, setRetestHours] = useState('6');
  const [notes, setNotes] = useState('');
  const [imageUri, setImageUri] = useState<string | undefined>();
  const [error, setError] = useState('');
  const [imageBusy, setImageBusy] = useState(false);
  const [quotaChecking, setQuotaChecking] = useState(true);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const lengthMeters = parseNumberInput(length);
  const widthMeters = parseNumberInput(width);
  const diameterMeters = parseNumberInput(diameter);
  const averageDepthMeters = parseNumberInput(averageDepth);
  const manualVolumeValue = parseNumberInput(manualVolume);

  const volumeLiters = useMemo(() => {
    if (method === 'manual') {
      return calculateManualVolumeLiters(manualVolumeValue, unit);
    }
    if (shape === 'round') {
      return calculatePoolVolume({ shape, diameter: diameterMeters, depth: averageDepthMeters });
    }
    return calculatePoolVolume({ shape, length: lengthMeters, width: widthMeters, depth: averageDepthMeters });
  }, [averageDepthMeters, diameterMeters, lengthMeters, manualVolumeValue, method, shape, unit, widthMeters]);

  useEffect(() => {
    let mounted = true;

    async function checkPoolQuota() {
      setQuotaChecking(true);
      const subscribed = await hasActiveSubscription(accountId);
      if (!mounted) return;
      if (!subscribed) {
        setSubscriptionRequired(true);
        setQuotaExceeded(true);
        setQuotaChecking(false);
        return;
      }

      const allowed = await canCreatePool(accountId, pools.length);
      if (!mounted) return;
      setSubscriptionRequired(false);
      setQuotaExceeded(!allowed);
      setQuotaChecking(false);
    }

    checkPoolQuota();

    return () => {
      mounted = false;
    };
  }, [accountId, pools.length]);

  async function pickPoolImage() {
    setImageBusy(true);
    setError('');

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError('יש לאפשר גישה לתמונות כדי להוסיף תמונת בריכה.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [16, 9],
        mediaTypes: ['images'],
        quality: 0.86,
      });

      if (result.canceled) return;
      const uri = result.assets[0]?.uri;
      if (uri) setImageUri(uri);
    } catch (pickerError) {
      console.warn('Failed to pick pool image', pickerError);
      setError('בחירת תמונת הבריכה נכשלה. אפשר לנסות שוב או לשמור בלי תמונה.');
    } finally {
      setImageBusy(false);
    }
  }

  async function save() {
    if (savingRef.current) return;

    if (!name.trim()) return setError('יש להזין שם לבריכה.');
    if (volumeLiters <= 0) return setError('יש להזין נפח ידני או מידות תקינות לחישוב נפח.');

    savingRef.current = true;
    setSaving(true);
    try {
      const subscribed = await hasActiveSubscription(accountId);
      if (!subscribed) {
        setSubscriptionRequired(true);
        setQuotaExceeded(true);
        return;
      }

      const allowed = await canCreatePool(accountId, pools.length);
      if (!allowed) {
        setSubscriptionRequired(false);
        setQuotaExceeded(true);
        return;
      }

      const tabletsActive = tabletsChoice === 'yes';
      const pool = addPool({
        name: name.trim(),
        type,
        sanitizerType: type,
        volumeLiters,
        volumeEntryMethod: method,
        volumeUnit: method === 'manual' ? unit : undefined,
        shape: method === 'dimensions' ? shape : undefined,
        lengthMeters: method === 'dimensions' && shape !== 'round' ? lengthMeters : undefined,
        widthMeters: method === 'dimensions' && shape !== 'round' ? widthMeters : undefined,
        diameterMeters: method === 'dimensions' && shape === 'round' ? diameterMeters : undefined,
        averageDepthMeters: method === 'dimensions' ? averageDepthMeters : undefined,
        stripBrandId: recommendedBrand.id,
        notes: notes.trim() || undefined,
        tabletsActive,
        tabletsCount: tabletsActive ? Math.max(1, Math.round(parseNumberInput(tabletsCount)) || 1) : 1,
        tabletWeightGrams: tabletsActive ? Math.max(1, Math.round(parseNumberInput(tabletWeight)) || 200) : 200,
        pumpHoursPerDay: Math.max(0, parseNumberInput(pumpHoursPerDay) || 8),
        retestHours: Math.max(1, parseNumberInput(retestHours) || 6),
        imageUri,
      });

      setError('');
      navigation.navigate('PoolDetails', { poolId: pool.id });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (quotaChecking) {
    return (
      <WebPhoneFrame>
        <ImageBackground source={ADD_POOL_IMAGE} resizeMode="cover" style={styles.root}>
          <View style={styles.waterWash} />
          <View style={styles.loadingContent}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingTitle}>בודקים את אפשרויות הבריכה</Text>
            <Text style={styles.loadingText}>רק רגע, אנחנו מוודאים מנוי ומכסת בריכות.</Text>
          </View>
        </ImageBackground>
      </WebPhoneFrame>
    );
  }

  if (quotaExceeded) {
    return (
      <WebPhoneFrame>
      <ImageBackground source={ADD_POOL_IMAGE} resizeMode="cover" style={styles.root}>
        <View style={styles.waterWash} />
        <View style={styles.quotaContent}>
          <View style={styles.quotaCard}>
            <View style={styles.quotaIcon}>
              <Text style={styles.imageIcon}>+</Text>
            </View>
            <Text style={styles.quotaTitle}>{subscriptionRequired ? 'נדרש מנוי פעיל' : 'המנוי הנוכחי כולל בריכה פעילה אחת'}</Text>
            <Text style={styles.quotaText}>
              {subscriptionRequired
                ? 'כדי ליצור בריכה, לסרוק סטיק ולקבל המלצות צריך להפעיל מנוי.'
                : 'כדי להוסיף בריכה נוספת ניתן יהיה לשדרג או להוסיף חבילת בריכה בקרוב.'}
            </Text>
            <Pressable onPress={() => navigation.navigate('Purchase', { reason: subscriptionRequired ? 'subscriptionRequired' : 'poolQuota' })} style={styles.quotaPrimaryBtn}>
              <Text numberOfLines={2} adjustsFontSizeToFit style={styles.quotaPrimaryBtnLabel}>{subscriptionRequired ? 'הפעל מנוי' : 'צפה באפשרויות שדרוג'}</Text>
            </Pressable>
            <Pressable onPress={() => navigation.navigate('Pools')} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnLabel}>חזרה לבריכות</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
      </WebPhoneFrame>
    );
  }

  return (
    <WebPhoneFrame>
    <ImageBackground source={ADD_POOL_IMAGE} resizeMode="cover" style={styles.root}>
    <View style={styles.waterWash} />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardRoot}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={() => navigation.navigate('Pools')}>
            <Text style={styles.iconGlyph}>‹</Text>
          </Pressable>
          <Text style={styles.heading}>בריכה חדשה</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <SectionLabel label="תמונת בריכה" />
          <PoolImagePicker imageBusy={imageBusy} imageUri={imageUri} onPick={pickPoolImage} onRemove={() => setImageUri(undefined)} />

          <Field label="שם הבריכה" value={name} onChangeText={setName} placeholder="למשל: הבריכה בבית" />

          <SectionLabel label="סוג בריכה" />
          <ToggleGroup
            value={type}
            onChange={(value) => setType(value as PoolType)}
            options={[
              { value: 'chlorine', label: 'כלור רגיל' },
              { value: 'salt', label: 'בריכת מלח' },
            ]}
          />

          <SectionLabel label="הזנת נפח" />
          <ToggleGroup
            value={method}
            onChange={(value) => setMethod(value as PoolVolumeEntryMethod)}
            options={[
              { value: 'manual', label: 'ידני' },
              { value: 'dimensions', label: 'לפי מידות' },
            ]}
          />

          {method === 'manual' ? (
            <View style={styles.group}>
              <ToggleGroup
                value={unit}
                onChange={(value) => setUnit(value as PoolVolumeUnit)}
                options={[
                  { value: 'liters', label: 'ליטרים' },
                  { value: 'cubic', label: 'קוב' },
                ]}
              />
              <Field label={unit === 'liters' ? 'נפח בליטרים' : 'נפח בקוב'} value={manualVolume} onChangeText={setManualVolume} placeholder={unit === 'liters' ? '12000' : '12'} numeric />
            </View>
          ) : (
            <View style={styles.group}>
              <ToggleGroup
                value={shape}
                onChange={(value) => setShape(value as PoolShape)}
                options={[
                  { value: 'rectangle', label: 'מלבנית' },
                  { value: 'round', label: 'עגולה' },
                  { value: 'oval', label: 'אובלית' },
                ]}
              />

              {shape === 'round' ? (
                <Field label="קוטר (מ')" value={diameter} onChangeText={setDiameter} placeholder="4.5" numeric />
              ) : (
                <View style={styles.grid}>
                  <View style={{ flex: 1 }}>
                    <Field label="אורך (מ')" value={length} onChangeText={setLength} placeholder="8" numeric />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field label="רוחב (מ')" value={width} onChangeText={setWidth} placeholder="4" numeric />
                  </View>
                </View>
              )}

              <Field label="עומק ממוצע (מ')" value={averageDepth} onChangeText={setAverageDepth} placeholder="1.5" numeric />
            </View>
          )}

          <View style={styles.volumeBox}>
            <Text style={styles.volumeLabel}>נפח מחושב</Text>
            <Text style={styles.volumeValue}>{volumeLiters > 0 ? volumeLiters.toLocaleString('he-IL') : '0'} ליטר</Text>
          </View>

          <SectionLabel label="סטיק ברירת מחדל" />
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{recommendedBrand.nameHe}</Text>
            <Text style={styles.infoLabel}>אפשר לשנות לפני כל סריקה</Text>
          </View>

          <SectionLabel label="טבליות כלור פעילות כרגע?" />
          <ToggleGroup
            value={tabletsChoice}
            onChange={(value) => setTabletsChoice(value as TabletsChoice)}
            options={[
              { value: 'yes', label: 'כן' },
              { value: 'no', label: 'לא' },
              { value: 'unknown', label: 'לא יודע' },
            ]}
          />

          {tabletsChoice === 'yes' ? (
            <View style={styles.grid}>
              <View style={{ flex: 1 }}>
                <Field label="מספר טבליות" value={tabletsCount} onChangeText={setTabletsCount} placeholder="1" numeric />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="משקל טבליה (גרם)" value={tabletWeight} onChangeText={setTabletWeight} placeholder="200" numeric />
              </View>
            </View>
          ) : null}

          <Field label="שעות משאבה ביום" value={pumpHoursPerDay} onChangeText={setPumpHoursPerDay} placeholder="8" numeric />

          <SectionLabel label="בדיקה חוזרת בעוד" />
          <ToggleGroup
            value={retestHours}
            onChange={setRetestHours}
            options={[
              { value: '3', label: '3 שעות' },
              { value: '6', label: '6 שעות' },
              { value: '12', label: '12 שעות' },
              { value: '24', label: '24 שעות' },
            ]}
          />

          <Field label="הערות (אופציונלי)" value={notes} onChangeText={setNotes} placeholder="כיסוי, חשיפה לשמש, וכו'" multiline />

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <Pressable disabled={saving || quotaChecking} onPress={save} style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.9 }, (saving || quotaChecking) && styles.disabled]}>
          {saving ? <ActivityIndicator color={colors.white} size="small" /> : null}
          <Text style={styles.primaryBtnLabel}>{saving ? 'שומר בריכה...' : 'שמירת בריכה'}</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('Pools')} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnLabel}>ביטול</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
    </ImageBackground>
    </WebPhoneFrame>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

function PoolImagePicker({
  imageBusy,
  imageUri,
  onPick,
  onRemove,
}: {
  imageBusy: boolean;
  imageUri?: string;
  onPick: () => void;
  onRemove: () => void;
}) {
  return (
    <View style={styles.imagePickerWrap}>
      <Pressable onPress={onPick} disabled={imageBusy} style={({ pressed }) => [styles.imagePicker, pressed && styles.pressed, imageBusy && styles.disabled]}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imageIcon}>+</Text>
            <Text style={styles.imageTitle}>{imageBusy ? 'פותח תמונות...' : 'הוסף תמונת בריכה'}</Text>
            <Text style={styles.imageHint}>תמונה עוזרת לזהות את הבריכה מהר יותר</Text>
          </View>
        )}
      </Pressable>
      {imageUri ? (
        <View style={styles.imageActions}>
          <Pressable onPress={onPick} style={styles.imageActionButton}>
            <Text style={styles.imageActionText}>החלפת תמונה</Text>
          </Pressable>
          <Pressable onPress={onRemove} style={styles.imageRemoveButton}>
            <Text style={styles.imageRemoveText}>הסרה</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ToggleGroup({
  onChange,
  options,
  value,
}: {
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  value: string;
}) {
  return (
    <View style={styles.toggleGroup}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.toggleOption, selected && styles.toggleOptionSelected]}>
            <Text style={[styles.toggleText, selected && styles.toggleTextSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, numeric, multiline }: {
  label: string; value: string; onChangeText: (value: string) => void;
  placeholder?: string; numeric?: boolean; multiline?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={fieldStyles.label}>{label}</Text>
      <TextInput
        style={[fieldStyles.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={(nextValue) => onChangeText(numeric ? normalizeNumericInput(nextValue) : nextValue)}
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
  keyboardRoot: { flex: 1 },
  waterWash: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(245,253,255,0.72)' },
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 28 },
  loadingTitle: { color: colors.text, fontSize: 18, fontWeight: '900', fontFamily: typography.fontFamilyBold, ...rtl.textCenter },
  loadingText: { color: colors.textSoft, fontSize: 13, lineHeight: 20, fontWeight: '800', fontFamily: typography.fontFamilyRegular, ...rtl.textCenter },
  content: { paddingHorizontal: 20, paddingTop: 50, paddingBottom: 40 },
  quotaContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  quotaCard: { width: '100%', maxWidth: 350, backgroundColor: colors.card, borderRadius: 28, padding: 20, gap: 14, alignItems: 'center', ...shadows.card },
  quotaIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  quotaTitle: { color: colors.text, fontSize: 18, fontWeight: '900', fontFamily: typography.fontFamilyBold, ...rtl.textCenter },
  quotaText: { color: colors.textSoft, fontSize: 13, lineHeight: 20, fontWeight: '800', fontFamily: typography.fontFamilyRegular, ...rtl.textCenter },
  quotaPrimaryBtn: {
    width: '100%',
    marginTop: 6,
    minHeight: 56,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
  },
  quotaPrimaryBtnLabel: {
    color: colors.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '900',
    fontFamily: typography.fontFamilyBold,
    ...rtl.textCenter,
  },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', ...shadows.card },
  iconGlyph: { fontSize: 24, color: colors.text, fontWeight: '900' },
  heading: { fontSize: 18, fontWeight: '900', color: colors.text, ...rtl.textCenter, flex: 1, fontFamily: typography.fontFamily },
  card: { backgroundColor: colors.card, borderRadius: 28, padding: 20, gap: 14, ...shadows.card },
  sectionLabel: { color: colors.text, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamilySemiBold, ...rtl.text },
  group: { gap: 12 },
  grid: { flexDirection: 'row-reverse', gap: 12 },
  toggleGroup: { flexDirection: 'row-reverse', gap: 8 },
  toggleOption: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    alignItems: 'center',
  },
  toggleOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  toggleText: { color: colors.textSoft, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamilySemiBold, ...rtl.textCenter },
  toggleTextSelected: { color: colors.white },
  volumeBox: { backgroundColor: '#ECFEFF', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: '#BDECF6' },
  volumeLabel: { color: colors.primaryDark, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  volumeValue: { marginTop: 4, color: colors.primaryDark, fontSize: 22, fontWeight: '900', ...rtl.text, fontFamily: typography.fontFamily },
  infoRow: {
    borderRadius: 18,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: 12,
  },
  infoValue: { color: colors.text, fontSize: 13, fontWeight: '900', fontFamily: typography.fontFamilyBold, ...rtl.text },
  infoLabel: { marginTop: 3, color: colors.muted, fontSize: 11, fontWeight: '800', fontFamily: typography.fontFamilyRegular, ...rtl.text },
  error: { color: colors.danger, fontSize: 13, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  imagePickerWrap: { gap: 9 },
  imagePicker: {
    height: 154,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
  },
  imagePreview: { width: '100%', height: '100%' },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ECFEFF',
  },
  imageIcon: { color: colors.primaryDark, fontSize: 28, fontWeight: '900', fontFamily: typography.fontFamily },
  imageTitle: { color: colors.text, fontSize: 14, fontWeight: '900', fontFamily: typography.fontFamilyBold, ...rtl.textCenter },
  imageHint: { color: colors.muted, fontSize: 11, fontWeight: '800', fontFamily: typography.fontFamilyRegular, ...rtl.textCenter },
  imageActions: { flexDirection: 'row-reverse', gap: 8 },
  imageActionButton: { flex: 1, borderRadius: 999, backgroundColor: colors.primarySoft, paddingVertical: 10, alignItems: 'center' },
  imageActionText: { color: colors.primaryDark, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamilySemiBold },
  imageRemoveButton: { borderRadius: 999, backgroundColor: colors.dangerSoft, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  imageRemoveText: { color: colors.danger, fontSize: 12, fontWeight: '900', fontFamily: typography.fontFamilySemiBold },
  primaryBtn: { marginTop: 18, backgroundColor: colors.primary, borderRadius: 999, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8, ...shadows.button },
  primaryBtnLabel: { color: colors.white, fontSize: 16, fontWeight: '900', fontFamily: typography.fontFamily },
  secondaryBtn: { marginTop: 8, paddingVertical: 12, alignItems: 'center' },
  secondaryBtnLabel: { color: colors.muted, fontSize: 14, fontWeight: '800', fontFamily: typography.fontFamily },
  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.62 },
});

const fieldStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 12, fontWeight: '800', ...rtl.text, fontFamily: typography.fontFamily },
  input: {
    backgroundColor: '#F5FAFD', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
    textAlign: 'right', writingDirection: 'rtl', fontFamily: typography.fontFamily,
  },
});
