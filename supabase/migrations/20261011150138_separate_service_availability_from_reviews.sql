-- User-authorized service operation without marking unfinished reviews as completed.
-- The legacy releaseReady RPC field is retained as an availability flag.
alter table public.service_release_config
  add column service_enabled boolean not null default false;
comment on column public.service_release_config.service_enabled is
  'Operator-controlled service availability, independent of legal/provider/retention review status.';

create or replace function private.get_service_consent_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c public.service_release_config%rowtype;
  accepted boolean;
  ai_allowed boolean;
  deletion_pending boolean;
  available boolean;
begin
  if u is null then raise exception 'authentication required'; end if;
  select * into strict c from public.service_release_config where id = true;
  select exists(select 1 from public.service_consent_events e
    where e.user_id=u and e.terms_version=c.terms_version
      and e.privacy_version=c.privacy_version and e.adult_private_pool_use) into accepted;
  select e.allowed into ai_allowed from public.ai_consent_events e
    where e.user_id=u and e.version=c.ai_version order by recorded_at desc, id desc limit 1;
  select exists(select 1 from public.account_deletion_requests r
    where r.user_id=u and r.status in ('pending','processing')) into deletion_pending;
  available := c.service_enabled and c.private_pools_only
    and exists(select 1 from public.legal_document_versions where kind='terms' and version=c.terms_version)
    and exists(select 1 from public.legal_document_versions where kind='privacy' and version=c.privacy_version)
    and exists(select 1 from public.legal_document_versions where kind='ai' and version=c.ai_version);
  return jsonb_build_object(
    'serviceAccepted', accepted and not deletion_pending,
    'aiAllowed', coalesce(ai_allowed,false) and not deletion_pending,
    'deletionPending', deletion_pending,
    'releaseReady', available,
    'serviceAvailable', available,
    'reviewCompleted', c.legal_review_completed and c.ai_processing_verified and c.retention_policy_completed,
    'termsVersion', c.terms_version, 'privacyVersion', c.privacy_version, 'aiVersion', c.ai_version);
end; $$;
revoke all on function private.get_service_consent_status() from public, anon;
grant execute on function private.get_service_consent_status() to authenticated;

-- Append new document versions; preserve earlier snapshots and consent events.
insert into public.legal_document_versions(kind,version,content) values
('terms', '2026-10-11.1', '{"title":"תנאי שימוש","sections":[{"title":"השירות ותחום השימוש","body":"AquaSense מסייעת להעריך מדדי מים מצילום סטיק ולנהל היסטוריית בדיקות. השירות מיועד למבוגרים ולבריכות ביתיות פרטיות בישראל. הוא אינו מיועד לשמש מערכת בטיחות או ציות לבריכות ציבוריות, מסחריות, טיפוליות או ג׳קוזי."},{"title":"מגבלות הקריאה","body":"קריאה מצילום עשויה להיות שגויה או חלקית עקב תאורה, זמן הקריאה, סוג הסטיק או נתוני קלט. האפליקציה אינה בדיקת מעבדה, אינה בודקת את כל מזהמי המים ואינה מאשרת שהמים בטוחים לרחצה. טווחי ההשוואה המוצגים אינם טווחים מאושרים לכל סוג בריכה ומצב מים."},{"title":"טיפול בחומרים","body":"הגרסה הנוכחית אינה מחשבת מינון כימיקלים. יש לאמת את המדידה בבדיקה מתאימה ולקבל הוראות לפי המוצר, הריכוז, הנפח והמצב בפועל. אין להסתמך על תוצאה ישנה או על הערכה מצילום בלבד. יש לפעול לפי תווית היצרן ואיש מקצוע; אין לערבב חומרים. אין באפליקציה זמן המתנה מאושר לכניסה למים."},{"title":"חשבונות וקלט","body":"יש למסור נתונים נכונים ועדכניים, לשמור על פרטי הכניסה ולהעלות רק תמונות שמותר לך לשתף. צילום סטיק צריך להציג את הסטיק בלבד בלי אנשים ופרטים מזהים ברקע. בחשבון משותף ייתכן שחברי החשבון יוכלו לראות את נתוני הבריכות והבדיקות."},{"title":"ניתוח באמצעות AI","body":"ניתוח התמונה נעשה באמצעות Google Gemini לאחר הסכמה נפרדת. הסירוב מונע סריקה התלויה בשירות זה. ניתן לבטל את ההסכמה בהגדרות; הביטול מונע העברות עתידיות ואינו מבטל עיבוד שכבר בוצע. פירוט השיתוף מופיע במדיניות הפרטיות."},{"title":"מנויים ורכישות","body":"מחיר, מטבע, תקופה והצעה קובעת מוצגים על ידי חנות המכשיר לפני אישור רכישה. מנויים מתחדשים אוטומטית עד ביטול דרך Apple או Google Play לפי החנות. המנוי הבסיסי כולל בריכה אחת ועד 200 סריקות בתקופת המנוי. חבילת סריקות נוספת היא רכישה חד־פעמית לתקופת המכסה הפעילה; יש לבדוק את מועד סיומה במסך השימוש. אין לרכוש כשהמחיר או תנאי ההצעה אינם זמינים."},{"title":"ביטול, החזר וכשל","body":"ניהול מנוי וביטול חידוש מתבצעים דרך החנות. פנייה על חיוב או כשל שירות אפשר להגיש לתמיכה, עם תאריך ומזהה רכישה בלי סיסמה. זכויות ביטול, החזר ותרופות שמוקנות בדין נשמרות. מחיקת חשבון אינה מבטלת אוטומטית מנוי בחנות."},{"title":"אחריות וזכויות חובה","body":"המידע הוא הערכה מסייעת בהיקף היכולת המתואר כאן. אין התחייבות לדיוק מוחלט או לזמינות רציפה. אין בתנאים פטור מאחריות לנזק גוף או למעשה זדון המוטלת על המפעיל לפי דין, או גריעה מזכות שאסור להתנות עליה. אחריות לנזק תיבחן לפי הדין והנסיבות; אישור התנאים אינו ויתור גורף על תביעה."},{"title":"פניות ואירועי בטיחות","body":"במקרה של ספק או סתירה במדדים יש לעצור טיפול המבוסס על התוצאה ולקבל הנחיה מתאימה. לפניות שירות, פרטיות או דיווח על תוצאה חשודה: support@dipcheck.app. אין למסור סיסמאות או פרטי כרטיס תשלום."},{"title":"גרסה ומעמד המסמך","body":"גרסה 2026-10-11.1. מפעילת השירות: אואקי הנדסה. פרטי הרישום והכתובת העסקית נמצאים בהשלמה. הבדיקה המשפטית טרם הושלמה; מסמך זה הוא נוסח עבודה. עדכון מהותי בנוסח ילווה בגרסה חדשה ובהסכמה מתאימה."}]}'::jsonb),
('privacy', '2026-10-11.1', '{"title":"מדיניות פרטיות","sections":[{"title":"המידע שנאסף","body":"פרטי חשבון כמו אימייל ושם תצוגה, שם וטלפון אם מסרת אותם, נתוני התחברות, פרטי בריכות, תמונות סטיק ובריכה, תוצאות והיסטוריית בדיקות, נתוני מכסה ורכישות ומידע טכני להפעלה ואבטחה. שם וטלפון אינם חובה בהרשמה הרגילה. שימוש כאורח עדיין יוצר חשבון שירות ומידע המשויך אליו."},{"title":"מטרות והבחירה שלך","body":"המידע משמש להתחברות, ניהול בריכות ובדיקות, ניתוח תמונת סטיק, הפעלת מנוי, תמיכה ואבטחה. אימייל נדרש להרשמה בדוא״ל. מצלמה או בחירת תמונה נדרשות רק לצילום או העלאה; התראות הן בחירה. סירוב לשיתוף עם AI מונע ניתוח חדש באמצעותו. אין למידע היתר אוטומטי לשיווק."},{"title":"Supabase וחשבונות משותפים","body":"Supabase משמשת לאימות, אחסון נתוני השירות ותמונות ולעיבוד בצד השרת. משתמשים מורשים בחשבון משותף עשויים לגשת לנתוני הבריכות והבדיקות שלו. גישה תפעולית מורשית עשויה להידרש לתמיכה ואבטחה. אין הבטחה לאבטחה מוחלטת."},{"title":"Google Gemini","body":"לניתוח נשלחים ל־Google Gemini תמונת הסטיק, סוג הסטיק ונתוני צילום הנחוצים לקריאה, כמו זמן הקריאה ובדיקת איכות. התמונה יכולה להכיל פרטים אישיים אם נכללו ברקע. לכן יש לצלם את הסטיק בלבד. נדרשת הסכמה מפורשת לפני העברה, ואפשר לבטלה בהגדרות."},{"title":"תנאי הספק והעברה לחו״ל","body":"Supabase ו־Google עשויות לעבד מידע מחוץ לישראל. תנאי Google לגבי שמירה ושימוש בתוכן משתנים לפי מסלול החשבון וההסכם. אין כאן הבטחה שתוכן אינו משמש לשיפור מודלים. פרטי מסלול הספקים, ההסכמים, אזורי העיבוד והבסיס להעברה נמצאים בהשלמה. ניתוח תמונה מתבצע לאחר הסכמה נפרדת לשיתוף עם Google Gemini."},{"title":"Apple ו־Google Play","body":"רכישות נעשות בחנות המכשיר. השירות משתמש במזהי רכישה ואימות ומצב מנוי כדי להפעיל מכסות; פרטי כרטיס התשלום אינם מוזנים באפליקציה. כניסה באמצעות Apple או Google כפופה גם לתנאי הספק הרלוונטי."},{"title":"שמירה, הסכמות ומחיקה","body":"תמונות, תוצאות ופרטי בריכה נשמרים לצורך השירות; חלק מהמידע נשמר גם במכשיר. הסכמות מתועדות בשרת עם גרסת המסמך, מועד השרת וזיהוי התוכן. ביטול הסכמת AI חל על העברות עתידיות. בקשת מחיקה נרשמת בשרת ומוצג מזהה פנייה; הודעת קבלה אינה אישור שהמחיקה בוצעה. שימור עקב חובה בדין, מחלוקת, חיוב או אבטחה ייבחן בהיקף הנדרש בלבד. זמני שמירה לכל קטגוריה ולגיבויים טרם אושרו, ויש להשלים אותם לפני הפצה."},{"title":"בקשות וזכויות","body":"אפשר לבקש עיון, תיקון ומחיקה בהתאם לדין דרך support@dipcheck.app ובמסך מחיקת החשבון. ייתכן שנדרש אימות זהות. מחיקת חשבון משותף מחייבת הבחנה בין המידע שלך למידע של משתמשים אחרים. אין למסור סיסמה לצורך בקשה."},{"title":"קטינים","body":"השירות מיועד למבוגרים ואינו מיועד לשימוש ילדים. אם נודע על מידע של קטין, יש לפנות לתמיכה לבירור וטיפול מתאים. אין להפקיד טיפול בכימיקלים בידי ילד."},{"title":"מפעיל ועדכונים","body":"גרסה 2026-10-11.1. מפעילת השירות ובעלת השליטה במידע: אואקי הנדסה. לפניות פרטיות: support@dipcheck.app. פרטי הרישום, הכתובת העסקית ומדיניות השמירה נמצאים בהשלמה. הבדיקה המשפטית טרם הושלמה; מסמך זה הוא נוסח עבודה. עדכון מהותי בנוסח ילווה בגרסה חדשה ובהסכמה מתאימה."}]}'::jsonb),
('ai', '2026-10-11.1', '{"title":"ניתוח באמצעות Google Gemini","sections":[{"title":"הסכמה לשיתוף","body":"כדי לקרוא את הסטיק נשלח ל־Google Gemini את תמונת הסטיק, סוג הסטיק ונתוני הצילום הנחוצים לניתוח. התמונה נשמרת גם בתשתית השירות בהתאם למדיניות הפרטיות. צלם את הסטיק בלבד, בלי אנשים או פרטים אישיים ברקע. ייתכן עיבוד מחוץ לישראל. תנאי שמירת התוכן והשימוש בו תלויים במסלול הספק; אין הבטחה שהמידע אינו משמש לשיפור מודלים. אפשר לסרב ולצפות במידע הקיים, ולבטל הסכמה בהגדרות."}]}'::jsonb);

-- Enable the service only. Incomplete review flags and operator details are unchanged.
update public.service_release_config
  set service_enabled=true, terms_version='2026-10-11.1',
    privacy_version='2026-10-11.1', ai_version='2026-10-11.1'
  where id=true;
notify pgrst, 'reload schema';
