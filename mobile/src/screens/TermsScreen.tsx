import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StaticInfoScreen } from '../components/StaticInfoScreen';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Terms'>;

export function TermsScreen({ navigation }: Props) {
  return (
    <StaticInfoScreen
      navigation={navigation}
      title="תנאי שימוש"
      subtitle="הבהרות חשובות לפני שימוש באפליקציה"
      sections={[
        {
          title: 'המלצות ולא בדיקת מעבדה',
          body: 'האפליקציה מספקת המלצות על בסיס תמונות סטיק ונתונים שהמשתמש מזין, כמו נפח הבריכה. היא אינה מערכת בטיחות מים מעבדתית או תחליף לבדיקה מקצועית.',
        },
        {
          title: 'אחריות המשתמש',
          body: 'המשתמש אחראי לפעול לפי הוראות יצרני הסטיקים וחומרי הבריכה, להוסיף חומרים בזהירות, ולא לערבב כימיקלים ישירות.',
        },
        {
          title: 'דיוק וזמינות',
          body: 'תוצאות עשויות להשתנות לפי איכות הצילום, תאורה, סטיק, נתוני בריכה וזמינות שירותי ענן. השירות עשוי לכלול טעויות או זמני השבתה.',
        },
        {
          title: 'מנויים ותוספות',
          body: 'תוכניות מנוי ותוספות כמו בריכות נוספות או חבילות סריקות עשויות להתווסף או להשתנות בהמשך. רכישות אמיתיות אינן פעילות בשלב זה.',
        },
        {
          title: 'שימוש אחראי',
          body: 'יש להשתמש באפליקציה ככלי עזר בלבד. במקרה של ספק לגבי איכות המים או בטיחות הבריכה, מומלץ לפנות לאיש מקצוע.',
        },
      ]}
    />
  );
}
