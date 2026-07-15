import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { BillingPurchasePanel } from '../components/BillingPurchasePanel';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { useAuth } from '../state/AuthContext';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Purchase'>;

const reasonCopy = {
  poolQuota: {
    title: 'הוספת בריכה נוספת',
    subtitle: 'המנוי הנוכחי כולל בריכה פעילה אחת. אפשר להוסיף הרחבה ולנהל עוד בריכות.',
  },
  scanQuota: {
    title: 'הוספת סריקות לחודש',
    subtitle: 'נגמרה מכסת הסריקות החודשית. אפשר להוסיף חבילת סריקות לחודש הנוכחי.',
  },
  subscriptionRequired: {
    title: 'נדרש מנוי פעיל',
    subtitle: 'כדי ליצור בריכות, לסרוק סטיק ולקבל המלצות צריך להפעיל מנוי.',
  },
};

export function PurchaseScreen({ navigation, route }: Props) {
  const { accountId } = useAuth();
  const reason = route.params?.reason ?? 'subscriptionRequired';
  const copy = reasonCopy[reason];

  return (
    <AppShell activeTab="settings" navigation={navigation} contentStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <LineIcon name="drop" color={colors.white} size={26} />
        </View>
        <Text style={styles.kicker}>AquaSense Premium</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>

      <Card style={styles.planCard}>
        <View style={styles.ribbon}>
          <LineIcon name="check" color={colors.white} size={14} />
          <Text style={styles.ribbonText}>המומלץ להתחלה</Text>
        </View>
        <Text style={styles.planTitle}>מנוי חודשי</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>30</Text>
          <Text style={styles.priceMeta}>₪ לחודש</Text>
        </View>
        <View style={styles.benefits}>
          <Benefit icon="scan" text="200 סריקות סטיק בכל חודש" />
          <Benefit icon="pools" text="בריכה פעילה אחת כלולה" />
          <Benefit icon="results" text="תוצאות והמלצות מיידיות" />
          <Benefit icon="bell" text="תזכורות בדיקה לבריכה" />
        </View>
      </Card>

      <BillingPurchasePanel accountId={accountId} onPurchaseVerified={() => navigation.navigate('Home')} />

      <View style={styles.legalLinks}>
        <Pressable onPress={() => navigation.navigate('Terms')} hitSlop={8}>
          <Text style={styles.legalLinkText}>תנאי שימוש</Text>
        </Pressable>
        <Text style={styles.legalSeparator}>•</Text>
        <Pressable onPress={() => navigation.navigate('PrivacyPolicy')} hitSlop={8}>
          <Text style={styles.legalLinkText}>מדיניות פרטיות</Text>
        </Pressable>
      </View>

      <Pressable style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]} onPress={() => navigation.navigate('PlanUsage', { reason })}>
        <Text style={styles.secondaryText}>צפה במכסה ובשימוש</Text>
      </Pressable>
    </AppShell>
  );
}

function Benefit({ icon, text }: { icon: 'bell' | 'pools' | 'results' | 'scan'; text: string }) {
  return (
    <View style={styles.benefitRow}>
      <View style={styles.benefitIcon}>
        <LineIcon name={icon} color={colors.primaryDark} size={17} />
      </View>
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
  },
  hero: {
    alignItems: 'center',
    marginTop: 8,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 58,
    justifyContent: 'center',
    width: 58,
    ...shadows.button,
  },
  kicker: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
    marginTop: 12,
    ...rtl.textCenter,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 27,
    fontWeight: '900',
    marginTop: 6,
    ...rtl.textCenter,
  },
  subtitle: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 8,
    ...rtl.textCenter,
  },
  planCard: {
    borderColor: 'rgba(11,179,204,0.28)',
    borderWidth: 1,
    gap: 12,
    marginTop: 18,
  },
  ribbon: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.round,
    flexDirection: 'row-reverse',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  ribbonText: {
    color: colors.white,
    fontFamily: typography.fontFamilyBold,
    fontSize: 12,
    fontWeight: '900',
  },
  planTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  priceRow: {
    alignItems: 'baseline',
    flexDirection: 'row-reverse',
    gap: 8,
    justifyContent: 'center',
  },
  price: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 46,
    fontWeight: '900',
  },
  priceMeta: {
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 16,
    fontWeight: '900',
  },
  benefits: {
    gap: 9,
  },
  benefitRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.borderSoft,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  benefitText: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: colors.white,
    borderColor: colors.borderSoft,
    borderRadius: radius.round,
    borderWidth: 1,
    marginTop: 14,
    paddingVertical: 13,
  },
  legalLinks: {
    alignItems: 'center',
    flexDirection: 'row-reverse',
    gap: 9,
    justifyContent: 'center',
    marginTop: 12,
  },
  legalLinkText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
  },
  legalSeparator: {
    color: colors.muted,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryText: {
    color: colors.primaryDark,
    fontFamily: typography.fontFamilyBold,
    fontSize: 13,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.86,
  },
});
