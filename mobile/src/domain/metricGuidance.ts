import type { ScanParameterStatusKind, ScanResultParameter } from './scanResults';
import type { StripParameter } from './strip';
import { comparisonKind } from './readingComparison';

export interface MetricGuidance {
  meaning: string;
  verification: string;
  steps: string[];
}

// General guidance, never a chemical quantity, a product-specific protocol or
// swim clearance. Comparison bands alone are not a treatment indication.
// Sources: CDC Home Pool Water Treatment and Testing / Pool Chemical Safety;
// Taylor Technologies Total Alkalinity; Pentair Pool Water Chemistry.
export const GUIDANCE_SOURCES = [
  { label: 'בדיקות מים וחיטוי — CDC', url: 'https://www.cdc.gov/healthy-swimming/about/home-pool-and-hot-tub-water-treatment-and-testing.html' },
  { label: 'בטיחות בחומרים — CDC', url: 'https://www.cdc.gov/healthy-swimming/toolkit/pool-chemical-safety.html' },
  { label: 'אלקליניות — Taylor Technologies', url: 'https://taylortechnologies.com/blogs/news/pool-total-alkalinity-explained' },
  { label: 'איזון מים — Pentair', url: 'https://www.pentair.com/en-us/education-support/water-education-center/pool-and-spa-education/water-chemistry.html' },
];

const VERIFY_CURRENT = 'בצע בדיקה עדכנית לפי הוראות הערכה. צילום או תוצאה שמורה הם הערכה של המים בזמן הבדיקה בלבד.';
const CHECK_SPEC = 'השווה את הבדיקה המאומתת להוראות מערכת החיטוי והמוצר שלך. טווח ההשוואה באפליקציה לבדו אינו סיבה להוסיף חומר.';
const SAFE_PRODUCTS = 'אם נדרש חומר, בחר מוצר שמתאים לבריכה ופעל לפי התווית. אין לערבב חומרים או לאלתר ריכוז ומינון.';

function guidanceFor(key: StripParameter, kind: ScanParameterStatusKind): MetricGuidance {
  if (kind === 'ok') return {
    meaning: 'ההערכה נמצאת בטווח ההשוואה המוצג. היא אינה מעידה על כל מזהמי המים ואינה אישור רחצה.',
    verification: VERIFY_CURRENT,
    steps: ['המשך מעקב לפי הנחיות התחזוקה של הבריכה. אין צורך להוסיף חומר רק כדי להגיע למרכז הטווח.',
      'בדוק שוב אחרי שינוי במים או טיפול, לפי הוראות הערכה והמוצר. אם המים עכורים או יש גירוי, קבל בדיקה והנחיה מתאימות.'],
  };
  if (key === 'ph') return {
    meaning: kind === 'high'
      ? 'pH גבוה יכול להפחית את יעילות הכלור. החריגה כאן היא ביחס לטווח ההשוואה שבאפליקציה.'
      : 'pH נמוך יכול להגדיל את הסיכון לקורוזיה בציוד. החריגה כאן היא ביחס לטווח ההשוואה שבאפליקציה.',
    verification: 'אמת את ה־pH בערכת בדיקה מתאימה עם ריאגנטים בתוקף ולפי הוראותיה; אל תפעל לפי צילום ישן.',
    steps: [CHECK_SPEC, 'בדוק גם אלקליניות וחומר חיטוי לפני תיקון: המדדים משפיעים זה על זה.',
      kind === 'high'
        ? 'אם בדיקה אמינה והוראות הציוד מאשרות שצריך להוריד pH, כיוון התיקון הוא הורדה. בחירת החומר וכמותו תלויים במוצר, בריכוז ובנפח הבריכה.'
        : 'אם בדיקה אמינה והוראות הציוד מאשרות שצריך להעלות pH, כיוון התיקון הוא העלאה. בחירת החומר וכמותו תלויים במוצר, בריכוז ובנפח הבריכה.',
      SAFE_PRODUCTS],
  };
  if (key === 'freeChlorine') return {
    meaning: kind === 'low'
      ? 'כלור חופשי הוא החלק הזמין לחיטוי. רמה נמוכה עלולה להעיד שאין מספיק חומר חיטוי, אך קריאת סטיק לבדה אינה קובעת זאת.'
      : 'ההערכה של הכלור החופשי גבוהה מטווח ההשוואה. אין לקבוע זמן רחצה או טיפול נוסף מהצילום.',
    verification: 'אמת כלור חופשי בערכת DPD לפי הוראותיה, ובדוק גם pH. אחרי טיפול מרוכז, כלור גבוה מאוד יכול להלבין את בדיקת הצבע וליצור קריאת אפס או קריאה נמוכה שגויה.',
    steps: [CHECK_SPEC, 'ברר אם החומר מכיל מייצב כלור או אם נוסף מייצב בנפרד; הדבר משנה את דרישות החיטוי.',
      kind === 'low'
        ? 'אם מדידה אמינה אישרה חוסר, בדוק שמערכת החיטוי פועלת לפי הוראות היצרן וקבל הוראות תיקון המתאימות למערכת. אל תוסיף עוד כלור בגלל קריאת אפס שלא אומתה.'
        : 'אל תוסיף עוד כלור כדי לתקן מדד אחר. בדוק את הגדרות מערכת החיטוי והטיפול האחרון מול המפרט; בירידת הערך יש להסתמך על בדיקה חוזרת, לא על זמן המתנה קבוע.',
      SAFE_PRODUCTS],
  };
  if (key === 'alkalinity') return {
    meaning: kind === 'low'
      ? 'אלקליניות מסייעת לייצב את ה־pH. אלקליניות נמוכה יכולה לגרום לשינויים חדים בו.'
      : 'אלקליניות גבוהה יכולה להקשות על איזון ה־pH. יש לבחון את שניהם יחד עם שאר נתוני המים.',
    verification: 'אמת אלקליניות בערכה ייעודית ובדוק pH. נתון של מייצב כלור, אם קיים, עשוי להשפיע על פירוש האלקליניות הכוללת.',
    steps: [CHECK_SPEC,
      kind === 'low'
        ? 'אם הבדיקה והמפרט מאשרים חוסר, כיוון התיקון הוא העלאת אלקליניות באמצעות מוצר מתאים. אין להסיק מהצילום איזו כמות נדרשת.'
        : 'אם הבדיקה והמפרט מאשרים עודף, כיוון התיקון הוא הפחתת אלקליניות בתוכנית שמביאה בחשבון גם pH. אל תטפל בשני המדדים בנפרד ללא בדיקה מלאה.',
      'לאחר טיפול מאושר, בדוק שוב גם אלקליניות וגם pH לפי הוראות המוצר.', SAFE_PRODUCTS],
  };
  if (key === 'salt') return {
    meaning: 'ריכוז המלח הנדרש נקבע לפי דגם מחולל הכלור. טווח כללי אינו מחליף את מפרט המכשיר.',
    verification: 'אמת מלח בערכה או במכשיר מתאים והשווה להוראות מחולל הכלור שלך, כולל דרישות כיול.',
    steps: [CHECK_SPEC, 'בדוק את דגם המכשיר, הודעותיו ושינויים אחרונים כמו מילוי מים. אל תוסיף מלח לפי צילום בלבד.',
      'אם החריגה אומתה, קבל הוראות תיקון לפי הדגם, נפח הבריכה והמדידה. אין לרוקן מים ללא בדיקת התאמה לבריכה.'],
  };
  if (key === 'hardness') return {
    meaning: 'קשיות היא חלק מאיזון המים יחד עם pH ואלקליניות. טווח מתאים תלוי גם בחומרי הבריכה ובציוד.',
    verification: 'בדוק האם הערכה מודדת קשיות כוללת או קשיות סידן. אלה מדדים שונים; אין להתייחס אליהם כתחליף זה לזה.',
    steps: [CHECK_SPEC, 'בצע בדיקת איזון מלאה לפני בחירת תיקון. אין להסיק מתוצאה זו אחוז החלפת מים או כמות חומר.'],
  };
  if (key === 'cyanuricAcid') return {
    meaning: 'חומצה ציאנורית היא מייצב כלור. נוכחותה משנה את דרישות החיטוי ואת פירוש חלק מהמדדים.',
    verification: 'אמת מייצב בערכה מתאימה ובדוק אם חומר הכלור שבו משתמשים מכיל אותו.',
    steps: [CHECK_SPEC, 'בדוק גם כלור חופשי ו־pH לפני שינוי הטיפול. אל תוסיף מייצב או תרוקן מים על סמך צילום בלבד.'],
  };
  return {
    meaning: key === 'totalChlorine' ? 'כלור כולל אינו זהה לכלור חופשי הזמין לחיטוי.' : 'קריאת ברום ניתנת לפירוש רק כשמערכת החיטוי והערכה מתאימות לברום.',
    verification: VERIFY_CURRENT,
    steps: ['ודא שסוג חומר החיטוי תואם לסקלה שעל הערכה. אין להשתמש בקריאת כלור כולל או ברום במקום קריאת כלור חופשי.', CHECK_SPEC],
  };
}

export function buildMetricGuidance(parameter: Pick<ScanResultParameter, 'key' | 'value' | 'idealRange'>): MetricGuidance | undefined {
  const kind = comparisonKind(parameter);
  if (!kind || parameter.value < 0 || (parameter.key === 'ph' && (parameter.value <= 0 || parameter.value > 14))) return undefined;
  return guidanceFor(parameter.key, kind);
}
