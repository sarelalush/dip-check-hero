import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectStrip'>;

const stripBrands = [
  {
    id: 'aquachek-pro-5in1',
    nameHe: 'AquaChek Pro 5-in-1',
    descriptionHe: 'הסטיק הנתמך כרגע לסריקה מלאה באפליקציה.',
    supported: true,
  },
  {
    id: 'other',
    nameHe: 'סטיקים נוספים',
    descriptionHe: 'נוסיף תמיכה בהמשך לפי בקשות משתמשים.',
    supported: false,
  },
];

export function SelectStripScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <View style={styles.hero}>
        <Text style={styles.step}>שלב 1 מתוך 2</Text>
        <Text style={styles.title}>באיזה סטיק אתה משתמש?</Text>
        <Text style={styles.subtitle}>בחר את החברה כדי להתאים את הצבעים לסריקה.</Text>
      </View>

      <View style={styles.list}>
        {stripBrands.map((brand) => (
          <Pressable
            key={brand.id}
            disabled={!brand.supported}
            onPress={() => navigation.navigate('Scan', { brandId: brand.id })}
            style={({ pressed }) => [
              styles.brandCard,
              !brand.supported && styles.disabledCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName}>{brand.nameHe}</Text>
              <Text style={styles.brandDescription}>{brand.descriptionHe}</Text>
            </View>
            <View style={[styles.badge, !brand.supported && styles.disabledBadge]}>
              <Text style={[styles.badgeText, !brand.supported && styles.disabledBadgeText]}>
                {brand.supported ? 'נתמך' : 'בקרוב'}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.requestButton}>
        <Text style={styles.requestText}>הסטיק שלי לא ברשימה</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    padding: 20,
    paddingTop: 58,
    minHeight: '100%',
  },
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    padding: 24,
  },
  step: {
    color: '#CFFAFE',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.5,
    textAlign: 'right',
  },
  title: {
    color: 'white',
    fontSize: 27,
    fontWeight: '900',
    textAlign: 'right',
    marginTop: 8,
  },
  subtitle: {
    color: '#E0F7FE',
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'right',
    marginTop: 8,
  },
  list: {
    marginTop: 20,
    gap: 12,
  },
  brandCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'right',
  },
  brandDescription: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
    textAlign: 'right',
  },
  badge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  badgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: '900',
  },
  disabledCard: {
    opacity: 0.65,
  },
  disabledBadge: {
    backgroundColor: '#F1F5F9',
  },
  disabledBadgeText: {
    color: colors.muted,
  },
  requestButton: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#9AD8E8',
    borderRadius: radius.xl,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 18,
  },
  requestText: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
});
