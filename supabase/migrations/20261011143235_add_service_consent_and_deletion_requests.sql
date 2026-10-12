-- Read-only document snapshots and server-timestamped, append-only consent events.
-- This migration does not approve release. Deployment readiness starts FALSE.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.service_release_config (
  id boolean primary key default true check (id),
  country text not null default 'IL' check (country = 'IL'),
  operator_name text,
  operator_address text,
  operator_business_id text,
  support_email text not null default 'support@dipcheck.app',
  legal_review_completed boolean not null default false,
  ai_processing_verified boolean not null default false,
  retention_policy_completed boolean not null default false,
  private_pools_only boolean not null default true,
  terms_version text not null default '2026-10-11',
  privacy_version text not null default '2026-10-11',
  ai_version text not null default '2026-10-11'
);
insert into public.service_release_config(id) values(true);
alter table public.service_release_config enable row level security;
revoke all on public.service_release_config from anon, authenticated;
grant select on public.service_release_config to anon, authenticated;
create policy "read release configuration" on public.service_release_config
  for select to anon, authenticated using (true);

create table public.legal_document_versions (
  kind text not null check (kind in ('terms','privacy','ai')),
  version text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  primary key(kind, version)
);
insert into public.legal_document_versions(kind,version,content) values
('terms', '2026-10-11', '{"title":"תנאי שימוש","sections":[{"title":"השירות ותחום השימוש","body":"AquaSense מסייעת להעריך מדדי מים מצילום סטיק ולנהל היסטוריית בדיקות. השירות מיועד למבוגרים ולבריכות ביתיות פרטיות בישראל. הוא אינו מיועד לשמש מערכת בטיחות או ציות לבריכות ציבוריות, מסחריות, טיפוליות או ג׳קוזי."},{"title":"מגבלות הקריאה","body":"קריאה מצילום עשויה להיות שגויה או חלקית עקב תאורה, זמן הקריאה, סוג הסטיק או נתוני קלט. האפליקציה אינה בדיקת מעבדה, אינה בודקת את כל מזהמי המים ואינה מאשרת שהמים בטוחים לרחצה. טווחי ההשוואה המוצגים אינם טווחים מאושרים לכל סוג בריכה ומצב מים."},{"title":"טיפול בחומרים","body":"הגרסה הנוכחית אינה מחשבת מינון כימיקלים. יש לאמת את המדידה בבדיקה מתאימה ולקבל הוראות לפי המוצר, הריכוז, הנפח והמצב בפועל. אין להסתמך על תוצאה ישנה או על הערכה מצילום בלבד. יש לפעול לפי תווית היצרן ואיש מקצוע; אין לערבב חומרים. אין באפליקציה זמן המתנה מאושר לכניסה למים."},{"title":"חשבונות וקלט","body":"יש למסור נתונים נכונים ועדכניים, לשמור על פרטי הכניסה ולהעלות רק תמונות שמותר לך לשתף. צילום סטיק צריך להציג את הסטיק בלבד בלי אנשים ופרטים מזהים ברקע. בחשבון משותף ייתכן שחברי החשבון יוכלו לראות את נתוני הבריכות והבדיקות."},{"title":"ניתוח באמצעות AI","body":"ניתוח התמונה נעשה באמצעות Google Gemini לאחר הסכמה נפרדת. הסירוב מונע סריקה התלויה בשירות זה. ניתן לבטל את ההסכמה בהגדרות; הביטול מונע העברות עתידיות ואינו מבטל עיבוד שכבר בוצע. פירוט השיתוף מופיע במדיניות הפרטיות."},{"title":"מנויים ורכישות","body":"מחיר, מטבע, תקופה והצעה קובעת מוצגים על ידי חנות המכשיר לפני אישור רכישה. מנויים מתחדשים אוטומטית עד ביטול דרך Apple או Google Play לפי החנות. המנוי הבסיסי כולל בריכה אחת ועד 200 סריקות בתקופת המנוי. חבילת סריקות נוספת היא רכישה חד־פעמית לתקופת המכסה הפעילה; יש לבדוק את מועד סיומה במסך השימוש. אין לרכוש כשהמחיר או תנאי ההצעה אינם זמינים."},{"title":"ביטול, החזר וכשל","body":"ניהול מנוי וביטול חידוש מתבצעים דרך החנות. פנייה על חיוב או כשל שירות אפשר להגיש לתמיכה, עם תאריך ומזהה רכישה בלי סיסמה. זכויות ביטול, החזר ותרופות שמוקנות בדין נשמרות. מחיקת חשבון אינה מבטלת אוטומטית מנוי בחנות."},{"title":"אחריות וזכויות חובה","body":"המידע הוא הערכה מסייעת בהיקף היכולת המתואר כאן. אין התחייבות לדיוק מוחלט או לזמינות רציפה. אין בתנאים פטור מאחריות לנזק גוף או למעשה זדון המוטלת על המפעיל לפי דין, או גריעה מזכות שאסור להתנות עליה. אחריות לנזק תיבחן לפי הדין והנסיבות; אישור התנאים אינו ויתור גורף על תביעה."},{"title":"פניות ואירועי בטיחות","body":"במקרה של ספק או סתירה במדדים יש לעצור טיפול המבוסס על התוצאה ולקבל הנחיה מתאימה. לפניות שירות, פרטיות או דיווח על תוצאה חשודה: support@dipcheck.app. אין למסור סיסמאות או פרטי כרטיס תשלום."},{"title":"גרסה ומעמד המסמך","body":"גרסה 2026-10-11. זהו נוסח עבודה מקומי: פרטי המפעיל והעסק והבדיקה המשפטית טרם הושלמו. אין בו אישור להפצה. לפני הפצה יש לפרט את זהות המפעיל ופרטי התקשרות עסקיים ולעדכן את הנוסח וההסכמה בהתאם."}]}'::jsonb),
('privacy', '2026-10-11', '{"title":"מדיניות פרטיות","sections":[{"title":"המידע שנאסף","body":"פרטי חשבון כמו אימייל ושם תצוגה, שם וטלפון אם מסרת אותם, נתוני התחברות, פרטי בריכות, תמונות סטיק ובריכה, תוצאות והיסטוריית בדיקות, נתוני מכסה ורכישות ומידע טכני להפעלה ואבטחה. שם וטלפון אינם חובה בהרשמה הרגילה. שימוש כאורח עדיין יוצר חשבון שירות ומידע המשויך אליו."},{"title":"מטרות והבחירה שלך","body":"המידע משמש להתחברות, ניהול בריכות ובדיקות, ניתוח תמונת סטיק, הפעלת מנוי, תמיכה ואבטחה. אימייל נדרש להרשמה בדוא״ל. מצלמה או בחירת תמונה נדרשות רק לצילום או העלאה; התראות הן בחירה. סירוב לשיתוף עם AI מונע ניתוח חדש באמצעותו. אין למידע היתר אוטומטי לשיווק."},{"title":"Supabase וחשבונות משותפים","body":"Supabase משמשת לאימות, אחסון נתוני השירות ותמונות ולעיבוד בצד השרת. משתמשים מורשים בחשבון משותף עשויים לגשת לנתוני הבריכות והבדיקות שלו. גישה תפעולית מורשית עשויה להידרש לתמיכה ואבטחה. אין הבטחה לאבטחה מוחלטת."},{"title":"Google Gemini","body":"לניתוח נשלחים ל־Google Gemini תמונת הסטיק, סוג הסטיק ונתוני צילום הנחוצים לקריאה, כמו זמן הקריאה ובדיקת איכות. התמונה יכולה להכיל פרטים אישיים אם נכללו ברקע. לכן יש לצלם את הסטיק בלבד. נדרשת הסכמה מפורשת לפני העברה, ואפשר לבטלה בהגדרות."},{"title":"תנאי הספק והעברה לחו״ל","body":"Supabase ו־Google עשויות לעבד מידע מחוץ לישראל. תנאי Google לגבי שמירה ושימוש בתוכן משתנים לפי מסלול החשבון וההסכם. אין כאן הבטחה שתוכן אינו משמש לשיפור מודלים. לפני הפצת גרסה זו חייבים לאמת את מסלול הספקים, ההסכמים, אזורי העיבוד והבסיס להעברה ולהשלים כאן את הפירוט; ניתוח חדש חסום בשרת עד אישור תצורת ההפצה."},{"title":"Apple ו־Google Play","body":"רכישות נעשות בחנות המכשיר. השירות משתמש במזהי רכישה ואימות ומצב מנוי כדי להפעיל מכסות; פרטי כרטיס התשלום אינם מוזנים באפליקציה. כניסה באמצעות Apple או Google כפופה גם לתנאי הספק הרלוונטי."},{"title":"שמירה, הסכמות ומחיקה","body":"תמונות, תוצאות ופרטי בריכה נשמרים לצורך השירות; חלק מהמידע נשמר גם במכשיר. הסכמות מתועדות בשרת עם גרסת המסמך, מועד השרת וזיהוי התוכן. ביטול הסכמת AI חל על העברות עתידיות. בקשת מחיקה נרשמת בשרת ומוצג מזהה פנייה; הודעת קבלה אינה אישור שהמחיקה בוצעה. שימור עקב חובה בדין, מחלוקת, חיוב או אבטחה ייבחן בהיקף הנדרש בלבד. זמני שמירה לכל קטגוריה ולגיבויים טרם אושרו, ויש להשלים אותם לפני הפצה."},{"title":"בקשות וזכויות","body":"אפשר לבקש עיון, תיקון ומחיקה בהתאם לדין דרך support@dipcheck.app ובמסך מחיקת החשבון. ייתכן שנדרש אימות זהות. מחיקת חשבון משותף מחייבת הבחנה בין המידע שלך למידע של משתמשים אחרים. אין למסור סיסמה לצורך בקשה."},{"title":"קטינים","body":"השירות מיועד למבוגרים ואינו מיועד לשימוש ילדים. אם נודע על מידע של קטין, יש לפנות לתמיכה לבירור וטיפול מתאים. אין להפקיד טיפול בכימיקלים בידי ילד."},{"title":"מפעיל ועדכונים","body":"גרסה 2026-10-11. זהו נוסח עבודה מקומי. זהות בעל השליטה במידע ופרטי העסק טרם הושלמו; אין לפרסם אותו כמדיניות סופית. לאחר השלמת המידע תעודכן הגרסה ותידרש הסכמה מתאימה לשינוי מהותי."}]}'::jsonb),
('ai', '2026-10-11', '{"title":"ניתוח באמצעות Google Gemini","sections":[{"title":"הסכמה לשיתוף","body":"כדי לקרוא את הסטיק נשלח ל־Google Gemini את תמונת הסטיק, סוג הסטיק ונתוני הצילום הנחוצים לניתוח. התמונה נשמרת גם בתשתית השירות בהתאם למדיניות הפרטיות. צלם את הסטיק בלבד, בלי אנשים או פרטים אישיים ברקע. ייתכן עיבוד מחוץ לישראל. תנאי שמירת התוכן והשימוש בו תלויים במסלול הספק; אין הבטחה שהמידע אינו משמש לשיפור מודלים. אפשר לסרב ולצפות במידע הקיים, ולבטל הסכמה בהגדרות."}]}'::jsonb);
alter table public.legal_document_versions enable row level security;
revoke all on public.legal_document_versions from anon, authenticated;
grant select on public.legal_document_versions to anon, authenticated;
create policy "read legal versions" on public.legal_document_versions
  for select to anon, authenticated using (true);

create table public.service_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  terms_snapshot jsonb not null,
  privacy_snapshot jsonb not null,
  terms_hash text not null,
  privacy_hash text not null,
  adult_private_pool_use boolean not null check (adult_private_pool_use),
  accepted_at timestamptz not null default now()
);
create index service_consent_user_idx on public.service_consent_events(user_id, accepted_at desc);
alter table public.service_consent_events enable row level security;
revoke all on public.service_consent_events from anon, authenticated;
grant select on public.service_consent_events to authenticated;
create policy "read own service consent" on public.service_consent_events
  for select to authenticated using (user_id = (select auth.uid()));

create table public.ai_consent_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  allowed boolean not null,
  document_snapshot jsonb not null,
  document_hash text not null,
  recorded_at timestamptz not null default now()
);
create index ai_consent_user_idx on public.ai_consent_events(user_id, recorded_at desc);
alter table public.ai_consent_events enable row level security;
revoke all on public.ai_consent_events from anon, authenticated;
grant select on public.ai_consent_events to authenticated;
create policy "read own AI consent" on public.ai_consent_events
  for select to authenticated using (user_id = (select auth.uid()));

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending' check(status in ('pending','processing','completed')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  -- Contact identity is intentionally not copied to this queue.
  operator_note text
);
create unique index one_open_deletion_request on public.account_deletion_requests(user_id)
  where status in ('pending','processing');
alter table public.account_deletion_requests enable row level security;
revoke all on public.account_deletion_requests from anon, authenticated;
grant select on public.account_deletion_requests to authenticated;
create policy "read own deletion requests" on public.account_deletion_requests
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function private.get_service_consent_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c public.service_release_config%rowtype;
  accepted boolean;
  ai_allowed boolean;
  deletion_pending boolean;
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
  return jsonb_build_object(
    'serviceAccepted', accepted and not deletion_pending,
    'aiAllowed', coalesce(ai_allowed,false) and not deletion_pending,
    'deletionPending', deletion_pending,
    'releaseReady', c.legal_review_completed and c.ai_processing_verified
      and c.retention_policy_completed and c.private_pools_only
      and length(trim(coalesce(c.operator_name,'')))>0
      and length(trim(coalesce(c.operator_address,'')))>0,
    'termsVersion', c.terms_version, 'privacyVersion', c.privacy_version, 'aiVersion', c.ai_version);
end; $$;

create or replace function private.record_service_consent(p_terms_version text, p_privacy_version text, p_adult_private_pool_use boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c public.service_release_config%rowtype;
  t jsonb; p jsonb;
begin
  if u is null then raise exception 'authentication required'; end if;
  if p_adult_private_pool_use is distinct from true then raise exception 'adult private pool use required'; end if;
  if exists(select 1 from public.account_deletion_requests where user_id=u and status in ('pending','processing'))
    then raise exception 'deletion request pending'; end if;
  select * into strict c from public.service_release_config where id=true;
  if (private.get_service_consent_status()->>'releaseReady')::boolean is distinct from true
    then raise exception 'service release review required'; end if;
  if p_terms_version is distinct from c.terms_version or p_privacy_version is distinct from c.privacy_version
    then raise exception 'document version changed'; end if;
  select content into strict t from public.legal_document_versions where kind='terms' and version=c.terms_version;
  select content into strict p from public.legal_document_versions where kind='privacy' and version=c.privacy_version;
  insert into public.service_consent_events(user_id,terms_version,privacy_version,terms_snapshot,privacy_snapshot,terms_hash,privacy_hash,adult_private_pool_use)
    values(u,c.terms_version,c.privacy_version,t,p,
      encode(sha256(convert_to(t::text,'UTF8')),'hex'),
      encode(sha256(convert_to(p::text,'UTF8')),'hex'),true);
  return private.get_service_consent_status();
end; $$;

create or replace function private.record_ai_consent(p_version text, p_allowed boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  c public.service_release_config%rowtype;
  d jsonb;
begin
  if u is null then raise exception 'authentication required'; end if;
  if p_allowed is null then raise exception 'choice required'; end if;
  select * into strict c from public.service_release_config where id=true;
  if p_version is distinct from c.ai_version then raise exception 'document version changed'; end if;
  if p_allowed and (private.get_service_consent_status()->>'releaseReady')::boolean is distinct from true
    then raise exception 'service release review required'; end if;
  if p_allowed and (private.get_service_consent_status()->>'serviceAccepted')::boolean is distinct from true
    then raise exception 'service consent required'; end if;
  -- Serialize choices for this user so two simultaneous requests have an order.
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select content into strict d from public.legal_document_versions where kind='ai' and version=c.ai_version;
  insert into public.ai_consent_events(user_id,version,allowed,document_snapshot,document_hash,recorded_at)
    values(u,c.ai_version,p_allowed,d,encode(sha256(convert_to(d::text,'UTF8')),'hex'),clock_timestamp());
  return private.get_service_consent_status();
end; $$;

create or replace function private.request_account_deletion(p_confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r public.account_deletion_requests%rowtype;
begin
  if u is null then raise exception 'authentication required'; end if;
  if p_confirmation is distinct from 'מחיקה' then raise exception 'confirmation required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,1));
  select * into r from public.account_deletion_requests where user_id=u and status in ('pending','processing');
  if r.id is null then
    insert into public.account_deletion_requests(user_id) values(u) returning * into r;
  end if;
  return jsonb_build_object('id',r.id,'status',r.status,'requestedAt',r.requested_at);
end; $$;

create function public.get_service_consent_status() returns jsonb
language sql security invoker set search_path = '' as $$ select private.get_service_consent_status() $$;
create function public.record_service_consent(p_terms_version text,p_privacy_version text,p_adult_private_pool_use boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select private.record_service_consent(p_terms_version,p_privacy_version,p_adult_private_pool_use) $$;
create function public.record_ai_consent(p_version text,p_allowed boolean) returns jsonb
language sql security invoker set search_path = '' as $$ select private.record_ai_consent(p_version,p_allowed) $$;
create function public.request_account_deletion(p_confirmation text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.request_account_deletion(p_confirmation) $$;

revoke all on function private.get_service_consent_status(), private.record_service_consent(text,text,boolean),
  private.record_ai_consent(text,boolean), private.request_account_deletion(text) from public, anon;
grant execute on function private.get_service_consent_status(), private.record_service_consent(text,text,boolean),
  private.record_ai_consent(text,boolean), private.request_account_deletion(text) to authenticated;
revoke all on function public.get_service_consent_status(), public.record_service_consent(text,text,boolean),
  public.record_ai_consent(text,boolean), public.request_account_deletion(text) from public, anon;
grant execute on function public.get_service_consent_status(), public.record_service_consent(text,text,boolean),
  public.record_ai_consent(text,boolean), public.request_account_deletion(text) to authenticated;
grant all on public.service_release_config, public.legal_document_versions,
  public.service_consent_events, public.ai_consent_events, public.account_deletion_requests to service_role;

-- Membership additions cannot race an accepted deletion request and turn a
-- solo account into a shared account just before ON DELETE CASCADE executes.
create function private.guard_membership_during_deletion()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  select owner_user_id into owner_id from public.accounts where id=new.account_id;
  if owner_id is null then raise exception 'account missing'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,1));
  if exists(select 1 from public.account_deletion_requests
      where user_id=owner_id and status in ('pending','processing'))
    then raise exception 'account deletion pending'; end if;
  if exists(select 1 from public.account_deletion_requests
      where user_id=new.user_id and status in ('pending','processing'))
    then raise exception 'member deletion pending'; end if;
  return new;
end; $$;
revoke all on function private.guard_membership_during_deletion() from public, anon, authenticated;
create trigger guard_membership_during_deletion
  before insert or update on public.account_members
  for each row execute function private.guard_membership_during_deletion();

notify pgrst, 'reload schema';
