import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StaticInfoScreen } from '../components/StaticInfoScreen';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PrivacyPolicy'>;

export function PrivacyPolicyScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      navigation={navigation}
      title="מדיניות פרטיות"
      subtitle="איך AquaSense שומרת ומשתמשת במידע שלך"
      sections={[
        {
          title: 'איזה מידע נשמר',
          body: 'אנחנו שומרים פרטי חשבון בסיסיים כמו אימייל ושם תצוגה, פרטי בריכות, תמונות בריכה, תמונות סטיק, תוצאות בדיקות מים ונתוני שימוש כמו מספר סריקות ובריכות פעילות.',
        },
        {
          title: 'למה התמונות משמשות',
          body: 'תמונות הסטיק משמשות כדי לנתח את צבעי ריבועי הבדיקה ולהפיק תוצאות והמלצות טיפול. תמונות בריכה משמשות לזיהוי נוח של הבריכה באפליקציה.',
        },
        {
          title: 'מפתחות וגישה',
          body: 'מפתחות API סודיים אינם נשמרים במכשיר. ניתוחים שדורשים שירות חיצוני מתבצעים דרך backend מאובטח ולא ישירות מתוך האפליקציה.',
        },
        {
          title: 'מחיקה ובקשות משתמש',
          body: 'ניתן לבקש מחיקת חשבון ומידע דרך התמיכה. מחיקה מלאה דורשת תהליך backend מאובטח כדי לוודא שהבקשה מגיעה מבעל החשבון.',
        },
        {
          title: 'שיתוף מידע',
          body: 'אנחנו לא מוכרים מידע אישי. מידע עשוי להישמר אצל ספקי תשתית כמו Supabase לצורך הפעלת השירות.',
        },
      ]}
    />
  );
}
