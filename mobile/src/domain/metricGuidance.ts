import type { ScanParameterStatusKind, ScanResultParameter, StripAnalysisResult } from './scanResults';
import type { StripParameter } from './strip';
import { comparisonKind, getChlorineReview, type ChlorineReview } from './readingComparison';
import { totalChlorinePresentation } from './chlorinePresentation';

export interface MetricGuidance {
  action: string;
  followUp: string;
  meaning: string;
  verification: string;
  steps: string[];
}

// General guidance. Separate stagedDosage derives supported maintenance
// quantities; neither layer provides swim clearance.
// Sources: CDC Home Pool Water Treatment and Testing / Pool Chemical Safety;
// Taylor Technologies Total Alkalinity; Pentair Pool Water Chemistry.
export const GUIDANCE_SOURCES = [
  { label: 'מנת תחזוקה לחומצה — מסמך מוצר HASA', url: 'https://hasa.com/hubfs/Product%20Assets/Muriatic%20Acid/Muriatic%20Acid%20-%20Product%20Page.pdf' },
  { label: 'הרכב וצפיפות חומצת הייחוס — HASA', url: 'https://hasa.com/hubfs/Safety%20Data%20Sheets/SDS%20-%20Safety%20Data%20Sheets/HASA%20Muriatic%20Acid_2026.pdf' },
  { label: 'מנת פתיחה לנתרן פחמתי 99% — תווית HTH', url: 'https://images.thdstatic.com/catalog/pdfImages/e3/e33cb098-b9a6-4a26-83d2-1c7fecc0fa11.pdf' },
  { label: 'חישובי מינון ואיזון מים — מחלקת הבריאות של אינדיאנה', url: 'https://www.in.gov/health/eph/public-swimming-pool-and-spa-program/chemical-adjustment-formulas-for-swimming-pools/' },
  { label: 'ריכוזי כלור נוזלי — Olin', url: 'https://olinchloralkali.com/wp-content/uploads/sites/5/2025/08/Olin-Sodium-Hypochlorite-PSM.pdf' },
  { label: 'בדיקות מים וחיטוי — CDC', url: 'https://www.cdc.gov/healthy-swimming/about/home-pool-and-hot-tub-water-treatment-and-testing.html' },
  { label: 'כלור קשור ופער בין קריאות הכלור — CDC', url: 'https://www.cdc.gov/healthy-swimming/toolkit/chloramines-and-pool-operation.html' },
  { label: 'טיפול בכלור קשור — מחלקת הבריאות של אינדיאנה', url: 'https://www.in.gov/health/eph/files/How-To-Shock-The-Pool-2022.pdf' },
  { label: 'כלור חופשי, כולל וטיפול שוק — AquaChek', url: 'https://www.aquachek.com/faq/' },
  { label: 'בטיחות בחומרים — CDC', url: 'https://www.cdc.gov/healthy-swimming/toolkit/pool-chemical-safety.html' },
  { label: 'אלקליניות — Taylor Technologies', url: 'https://taylortechnologies.com/blogs/news/pool-total-alkalinity-explained' },
  { label: 'איזון מים — Pentair', url: 'https://www.pentair.com/en-us/education-support/water-education-center/pool-and-spa-education/water-chemistry.html' },
];

const VERIFY_CURRENT = 'בצע בדיקה עדכנית לפי הוראות הערכה. צילום או תוצאה שמורה הם הערכה של המים בזמן הבדיקה בלבד.';
const CHECK_SPEC = 'השווה את הבדיקה המאומתת להוראות מערכת החיטוי והמוצר שלך. טווח ההשוואה באפליקציה לבדו אינו סיבה להוסיף חומר.';
const SAFE_PRODUCTS = 'אם נדרש חומר, בחר מוצר שמתאים לבריכה ופעל לפי התווית. אין לערבב חומרים או לאלתר ריכוז ומינון.';

export interface ChlorineActionPlan {
  title: string;
  summary: string;
  explanation: string;
  steps: string[];
  treatmentNote?: string;
}

// App observation interval with no chemical addition. This is not a measured
// turnover time, a chloramine-removal protocol, or a swimming re-entry time.
export const CHLORINE_RECHECK_HOURS = 2;

// Scan-only follow-up directions, not a shock dose inferred from a photo.
// TC/FC alternatives may overlap: a gap is a suspicion, not confirmed CC.
export function buildChlorineActionPlan(review: ChlorineReview): ChlorineActionPlan {
  if (review.reason === 'inconsistent') return {
    title: 'קריאות הכלור אינן תואמות',
    summary: 'אל תוסיף חומר לפי הקריאה הסותרת; בדוק את שני סוגי הכלור.',
    explanation: 'כלור כולל אינו יכול להיות נמוך מכלור חופשי. אין להסיק מכאן שחסר כלור.',
    steps: [
      'אל תוסיף חומר לפי הקריאה הסותרת.',
      'טבול סטיק חדש וצלם אותו באפליקציה לפי הוראות הסטיק.',
      'אם הסתירה חוזרת, פנה לאיש בריכות לפני טיפול בחומרים.',
    ],
  };
  return {
    title: 'סחרור ובדיקה חוזרת',
    summary: `הפעל סחרור וסינון וסרוק סטיק חדש לאחר ${CHLORINE_RECHECK_HOURS} שעות.`,
    explanation: 'כלור כולל מורכב מכלור חופשי וכלור קשור. הפער בסריקה מעלה חשד לכלור קשור. הצעד הנוכחי הוא מעקב ללא הוספת חומר; סחרור וסינון לבדם אינם מבטיחים שהפער יתוקן.',
    steps: [
      `הפעל את משאבת הסחרור והסינון למשך ${CHLORINE_RECHECK_HOURS} שעות, לפי הוראות המערכת.`,
      'אל תוסיף כעת כלור, חומר שוק או מנטרל לפי הבדיקה הזו.',
      `לאחר ${CHLORINE_RECHECK_HOURS} שעות, סרוק סטיק חדש באפליקציה. אם הפער נשאר, פנה לאיש בריכות.`,
    ],
    treatmentNote: 'שעתיים הן מרווח מעקב באפליקציה, ולא זמן תיקון מובטח או אישור רחצה. אם הוספת חומר, זמן ההמתנה שבתווית קודם. אם הפער נשאר בסריקה החוזרת, או שיש עכירות או גירוי, פנה לאיש בריכות; אין להמשיך בסבבי סחרור בלבד או לנחש כמות שוק.',
  };
}

// A visible action route, independent of whether a numeric proposal was saved.
// The upper TC candidate can trigger review, never a CC result or shock dose.
// Original parameters, chlorine-pair evidence and numeric eligibility stay intact.
export function buildScanChlorineActionPlan(result: StripAnalysisResult): ChlorineActionPlan | undefined {
  if (result.accepted === false || result.isValidStrip === false || result.lowConfidence ||
      result.source === 'mock' || result.source === 'remote-mock' ||
      (result.failureReason && result.failureReason !== 'none')) return undefined;
  const review = getChlorineReview(result.parameters);
  if (review?.reason === 'inconsistent') return buildChlorineActionPlan(review);
  const total = totalChlorinePresentation(result.parameters.find(parameter => parameter.key === 'totalChlorine'));
  const free = result.parameters.find(parameter => parameter.key === 'freeChlorine');
  const freeKind = free ? comparisonKind(free) : undefined;
  const totalOutside = total?.kind === 'high' || total?.kind === 'low';
  if (!review && !totalOutside) return undefined;
  if (freeKind === 'high') return {
    title: 'מפחיתים את הכלור הגבוה',
    summary: 'הפחת או השהה הזנת כלור לפי הוראות המערכת והמשך סחרור.',
    explanation: 'גם הכלור החופשי גבוה מטווח ההשוואה. זה מסלול להפחתת הזנת כלור; אין להוסיף עוד כלור רק בגלל הכלור הכולל.',
    steps: [
      'אל תוסיף כלור נוסף. הפחת או השהה הזנת כלור לפי הוראות המערכת.',
      'הפעל סחרור וסינון לפי הוראות המערכת.',
      'בדוק שוב כלור חופשי ו־pH לפני חידוש ההזנה, לפי דרישות המוצר והמערכת.',
    ],
    treatmentNote: 'אין להסיק זמן רחצה מהצילום. אין להוסיף מנטרל כלור ללא הוראות למוצר המסוים.',
  };
  if (review?.reason === 'gap') return buildChlorineActionPlan(review);
  if (total?.usesUpperCandidate && total.kind === 'high' && free && freeKind && total.value > free.value) {
    const plan = buildChlorineActionPlan({ reason: 'gap' });
    return { ...plan,
      explanation: 'בכלור הכולל מוצגת האפשרות הגבוהה מבין שתי התאמות למקרא. היא מעלה חשד לפער מול הכלור החופשי; אין לראות בפער הזה מדידה של כלור קשור או לחשב ממנו כמות שוק.',
    };
  }
  return {
    title: 'משלימים את הטיפול בכלור',
    summary: 'בחר את תיקון הכלור לפי בדיקה עדכנית של הכלור החופשי והכולל.',
    explanation: 'חריגה בכלור הכולל לבדה אינה קובעת אם להוסיף כלור או להפחית אותו. נדרשת גם קריאה מתאימה של הכלור החופשי.',
    steps: [
      'הפעל סחרור וסינון לפי הוראות המערכת.',
      'טבול סטיק חדש וסרוק אותו באפליקציה כדי לקרוא את שני סוגי הכלור.',
      'בחר את הצעד הבא לפי הסריקה החדשה. אם לא מתקבלת קריאה מתאימה, פנה לאיש בריכות לפני הוספת חומר.',
    ],
  };
}

function guidanceFor(key: StripParameter, kind: ScanParameterStatusKind): MetricGuidance {
  if (kind === 'ok') return {
    action: 'אין צורך בתיקון בגלל מדד זה. המשך מעקב רגיל.',
    followUp: 'בדוק שוב לפי שגרת התחזוקה ואחרי שינוי במים.',
    meaning: 'ההערכה נמצאת בטווח ההשוואה המוצג. היא אינה מעידה על כל מזהמי המים ואינה אישור רחצה.',
    verification: VERIFY_CURRENT,
    steps: ['המשך מעקב לפי הנחיות התחזוקה של הבריכה. אין צורך להוסיף חומר רק כדי להגיע למרכז הטווח.',
      'בדוק שוב אחרי שינוי במים או טיפול, לפי הוראות הערכה והמוצר. אם המים עכורים או יש גירוי, קבל בדיקה והנחיה מתאימות.'],
  };
  if (key === 'ph') return {
    action: kind === 'high'
      ? 'אם החריגה אומתה, הוסף חומצת מלח (HCl) המיועדת לבריכות להורדת pH, לפי מינון התווית.'
      : 'אם החריגה אומתה, הוסף מעלה pH ‏(pH Plus), לפי מינון התווית.',
    followUp: 'אחרי הטיפול, בדוק שוב pH ואלקליניות במועד שמופיע בהוראות המוצר.',
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
    action: kind === 'low'
      ? 'אם סריקה עדכנית מאשרת חוסר, הוסף כלור נוזלי לבריכות לפי מינון התווית והוראות מערכת החיטוי.'
      : 'הפחת או השהה הזנת כלור לפי הוראות המערכת, והמשך סחרור.',
    followUp: kind === 'low'
      ? 'בדוק גם pH ומייצב לפני בחירת המינון; בדוק כלור שוב לפי הוראות המוצר.'
      : 'אל תוסיף מנטרל כלור ללא הוראות למוצר המסוים; אין לקבוע זמן רחצה מהצילום.',
    meaning: kind === 'low'
      ? 'כלור חופשי הוא החלק הזמין לחיטוי. רמה נמוכה עלולה להעיד שאין מספיק חומר חיטוי, אך קריאת סטיק לבדה אינה קובעת זאת.'
      : 'ההערכה של הכלור החופשי גבוהה מטווח ההשוואה. אין לקבוע זמן רחצה או טיפול נוסף מהצילום.',
    verification: 'טבול סטיק חדש וסרוק באפליקציה לפי הוראות הסטיק. אחרי טיפול מרוכז, קריאת אפס או קריאה נמוכה עלולה להיות שגויה; במקרה כזה פנה לאיש בריכות לפני הוספה נוספת.',
    steps: [CHECK_SPEC, 'ברר אם החומר מכיל מייצב כלור או אם נוסף מייצב בנפרד; הדבר משנה את דרישות החיטוי.',
      kind === 'low'
        ? 'אם מדידה אמינה אישרה חוסר, בדוק שמערכת החיטוי פועלת לפי הוראות היצרן וקבל הוראות תיקון המתאימות למערכת. אל תוסיף עוד כלור בגלל קריאת אפס שלא אומתה.'
        : 'אל תוסיף עוד כלור כדי לתקן מדד אחר. בדוק את הגדרות מערכת החיטוי והטיפול האחרון מול המפרט; בירידת הערך יש להסתמך על בדיקה חוזרת, לא על זמן המתנה קבוע.',
      SAFE_PRODUCTS],
  };
  if (key === 'alkalinity') return {
    action: kind === 'low'
      ? 'אם החריגה אומתה, הוסף מעלה אלקליניות (סודה לשתייה ייעודית לבריכות), לפי מינון התווית.'
      : 'אם החריגה אומתה, הוסף חומצת מלח (HCl) המיועדת לבריכות, לפי מינון התווית.',
    followUp: 'אחרי הטיפול, בדוק שוב אלקליניות ו־pH לפי הוראות המוצר.',
    meaning: kind === 'low'
      ? 'אלקליניות מסייעת לייצב את ה־pH. אלקליניות נמוכה יכולה לגרום לשינויים חדים בו.'
      : 'חומר שמוריד אלקליניות יכול להוריד גם את ערך ה־pH. לכן בודקים pH לפני הטיפול ואחריו, ובוחרים כל צעד לפי התוצאה העדכנית.',
    verification: 'אמת אלקליניות בערכה ייעודית ובדוק pH. נתון של מייצב כלור, אם קיים, עשוי להשפיע על פירוש האלקליניות הכוללת.',
    steps: [CHECK_SPEC,
      kind === 'low'
        ? 'אם הבדיקה והמפרט מאשרים חוסר, כיוון התיקון הוא העלאת אלקליניות באמצעות מוצר מתאים. אין להסיק מהצילום איזו כמות נדרשת.'
        : 'אם הבדיקה והמפרט מאשרים עודף, כיוון התיקון הוא הורדת אלקליניות באמצעות מוצר מתאים. התאם את הטיפול גם לקריאת ה־pH.',
      'לאחר טיפול מאושר, בדוק שוב גם אלקליניות וגם pH לפי הוראות המוצר.', SAFE_PRODUCTS],
  };
  if (key === 'salt') return {
    action: kind === 'low'
      ? 'אמת מלח מול מפרט מחולל הכלור. אם אושר חוסר, הוסף מלח לפי המפרט.'
      : 'אל תוסיף מלח. אמת את הקריאה מול מפרט המחולל לפני תכנון דילול מים.',
    followUp: 'בדוק שוב מלח לפי הוראות המחולל. לפני החלפת מים, בדוק התאמה לבריכה.',
    meaning: 'ריכוז המלח הנדרש נקבע לפי דגם מחולל הכלור. טווח כללי אינו מחליף את מפרט המכשיר.',
    verification: 'אמת מלח בערכה או במכשיר מתאים והשווה להוראות מחולל הכלור שלך, כולל דרישות כיול.',
    steps: [CHECK_SPEC, 'בדוק את דגם המכשיר, הודעותיו ושינויים אחרונים כמו מילוי מים. אל תוסיף מלח לפי צילום בלבד.',
      'אם החריגה אומתה, קבל הוראות תיקון לפי הדגם, נפח הבריכה והמדידה. אין לרוקן מים ללא בדיקת התאמה לבריכה.'],
  };
  if (key === 'hardness') return {
    action: kind === 'low'
      ? 'אמת שזו קשיות סידן ושנדרש תיקון; במקרה כזה השתמש במעלה קשיות לפי התווית.'
      : 'בצע בדיקת איזון מלאה לפני טיפול בקשיות גבוהה או החלפת מים.',
    followUp: 'בדוק גם pH ואלקליניות והתאם את היעד לחומרי הבריכה ולציוד.',
    meaning: 'קשיות היא חלק מאיזון המים יחד עם pH ואלקליניות. טווח מתאים תלוי גם בחומרי הבריכה ובציוד.',
    verification: 'בדוק האם הערכה מודדת קשיות כוללת או קשיות סידן. אלה מדדים שונים; אין להתייחס אליהם כתחליף זה לזה.',
    steps: [CHECK_SPEC, 'בצע בדיקת איזון מלאה לפני בחירת תיקון. אין להסיק מתוצאה זו אחוז החלפת מים או כמות חומר.'],
  };
  if (key === 'cyanuricAcid') return {
    action: kind === 'low'
      ? 'אמת שנדרש מייצב במערכת שלך; אם כן, הוסף מייצב לפי מינון התווית.'
      : 'אל תוסיף מייצב. בדוק אם מוצר הכלור מכיל מייצב לפני תכנון תיקון.',
    followUp: 'בדוק גם כלור חופשי ו־pH. אין לחשב החלפת מים בלי נתוני מי המילוי והבריכה.',
    meaning: 'חומצה ציאנורית היא מייצב כלור. נוכחותה משנה את דרישות החיטוי ואת פירוש חלק מהמדדים.',
    verification: 'אמת מייצב בערכה מתאימה ובדוק אם חומר הכלור שבו משתמשים מכיל אותו.',
    steps: [CHECK_SPEC, 'בדוק גם כלור חופשי ו־pH לפני שינוי הטיפול. אל תוסיף מייצב או תרוקן מים על סמך צילום בלבד.'],
  };
  return {
    action: key === 'totalChlorine'
      ? 'בדוק כלור חופשי בנפרד לפני שינוי במינון הכלור.'
      : 'אמת ברום בערכה המתאימה למערכת שלך ופעל לפי הוראות המוצר.',
    followUp: 'בדוק גם pH לפני שינוי הטיפול.',
    meaning: key === 'totalChlorine' ? 'כלור כולל אינו זהה לכלור חופשי הזמין לחיטוי.' : 'קריאת ברום ניתנת לפירוש רק כשמערכת החיטוי והערכה מתאימות לברום.',
    verification: VERIFY_CURRENT,
    steps: ['ודא שסוג חומר החיטוי תואם לסקלה שעל הערכה. אין להשתמש בקריאת כלור כולל או ברום במקום קריאת כלור חופשי.', CHECK_SPEC],
  };
}

export function buildMetricGuidance(parameter: Pick<ScanResultParameter, 'key' | 'value' | 'idealRange'>): MetricGuidance | undefined {
  const kind = comparisonKind(parameter);
  if (!kind || parameter.value < 0 || parameter.idealRange.min < 0 ||
    (parameter.key === 'ph' && (parameter.value <= 0 || parameter.value > 14 ||
      parameter.idealRange.min <= 0 || parameter.idealRange.max > 14))) return undefined;
  return guidanceFor(parameter.key, kind);
}
