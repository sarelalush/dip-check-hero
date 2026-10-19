import type { StripParameter } from './strip';

// Display copy only. Reading values, comparison ranges and treatment order
// continue to come from the existing analysis and treatment policy.
export const MEASUREMENT_COPY: Record<StripParameter, { label: string; description: string; explanation: string }> = {
  totalChlorine: {
    label: 'כלור כולל', description: 'סך הכלור במים',
    explanation: 'כולל כלור חופשי וגם כלור קשור, שכבר הגיב עם חומרים במים. כדי להבין את מצב החיטוי, קוראים אותו יחד עם הכלור החופשי.',
  },
  freeChlorine: {
    label: 'כלור חופשי', description: 'הכלור הזמין לחיטוי',
    explanation: 'זה החלק של הכלור שזמין לחיטוי המים. הוא שונה מכלור כולל, ולכן לא מחליפים בין שתי הקריאות.',
  },
  ph: {
    label: 'חומציות (pH)', description: 'עד כמה המים חומציים או בסיסיים',
    explanation: 'החומציות משפיעה על פעולת הכלור ועל איזון המים. ערך נמוך פירושו מים חומציים יותר; ערך גבוה פירושו מים בסיסיים יותר.',
  },
  alkalinity: {
    label: 'אלקליניות', description: 'עוזרת לשמור על חומציות יציבה',
    explanation: 'האלקליניות עוזרת למנוע שינויים חדים בחומציות. לכן בודקים אותה יחד עם pH ומטפלים לפי הסדר שמופיע למעלה.',
  },
  cyanuricAcid: {
    label: 'מייצב כלור', description: 'מגן על הכלור מפני אור השמש',
    explanation: 'נקרא גם חומצה ציאנורית. הכמות שלו משפיעה על דרישות הכלור במים, ולכן מפרשים את שני המדדים יחד.',
  },
  hardness: {
    label: 'קשיות המים', description: 'ריכוז מינרלים במים',
    explanation: 'סוג הקשיות שנמדד תלוי בערכה. קשיות כללית וקשיות סידן הן מדידות שונות; פירוט ההנחיות מופיע במידע הנוסף.',
  },
  salt: {
    label: 'מלח', description: 'לבריכות עם מחולל כלור ממלח',
    explanation: 'רמת המלח המתאימה נקבעת לפי דגם מחולל הכלור והוראות היצרן שלו.',
  },
  bromine: {
    label: 'ברום', description: 'חומר חיטוי למערכות ברום',
    explanation: 'משתמשים בסקלה הזו רק במערכת שמחטאת בברום. זו אינה מדידת כלור נוספת.',
  },
};
