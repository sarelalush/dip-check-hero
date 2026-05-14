
## מה נבנה

### 1. אימות (Authentication)
- **מסך התחברות** (`/login`) - דוא"ל + סיסמה, וגם כפתור Google
- **מסך הרשמה** (`/signup`) - שם, דוא"ל, סיסמה
- **כפתור "המשך כאורח"** - שמירה ב-localStorage כמו היום, עם אזהרה: "הבריכות שתשמור לא יישמרו ליותר מ-24 שעות ועלולות להימחק. הירשם כדי לשמור לתמיד"
- עיצוב לפי התמונה שהעלית: רקע כחול-טורקיז gradient, לוגו AquaSense עם טיפת מים, כפתורים מעוגלים גדולים, RTL
- שמירת מצב משתמש עם `onAuthStateChange`

### 2. מסד נתונים (Lovable Cloud)
שלוש טבלאות עם RLS:

**`profiles`** - פרופיל משתמש
- user_id, display_name, email, created_at

**`pools`** - בריכות לכל משתמש
- user_id, name, type (chlorine/salt), volume_liters, strip_brand_id, last_test_at

**`tests`** - בדיקות לכל בריכה
- pool_id, user_id, results (jsonb), recommendations (jsonb), image_url (אופציונלי), tested_at

RLS: כל משתמש רואה/עורך/מוחק רק את הנתונים שלו. trigger אוטומטי ליצירת פרופיל בהרשמה.

### 3. סנכרון נתונים
- משתמש מחובר → קריאה/כתיבה ל-Supabase דרך server functions עם `requireSupabaseAuth`
- אורח → ממשיך לעבוד עם localStorage (כמו היום)
- שכבת abstraction (`dataService`) שתבחר אוטומטית בין SB ל-LS לפי מצב המשתמש

### 4. דף בריכה משופר עם גרף
- בכניסה לבריכה: רשימת סריקות אחרונות (כבר קיים) + **גרף חדש** של pH, כלור, אלקליניות לאורך זמן (Recharts)
- כל פרמטר בקו נפרד עם רצועות יעד צבועות

### 5. ניווט
- אם לא מחובר ולא אורח → redirect ל-`/login`
- בנר עליון לאורחים: "אתה משתמש כאורח · הירשם לשמירה קבועה"

## פרטים טכניים

- שימוש ב-`@tanstack/react-router` לניווט
- Server functions ב-`src/lib/*.functions.ts` לכל פעולת DB
- Recharts כבר מותקן (`src/components/ui/chart.tsx`)
- אורח מזוהה ע"י flag ב-localStorage: `poolcheck.guest = true`
- אזהרת 24 שעות: כתוב על המסך הראשי ובכל מסך בריכה כשהמשתמש אורח
- ה-localStorage הקיים יישאר תואם — אם משתמש אורח נרשם בהמשך, אפשר להוסיף migration אופציונלי בעתיד
