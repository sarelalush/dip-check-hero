import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { SCAN_IMAGES_BUCKET } from '../services/scanImageStorage';
import { POOL_IMAGES_BUCKET } from '../services/poolImageStorage';
import { getDeviceEnvironmentDiagnostics } from '../services/deviceEnvironment';
import { getSupabaseClient, isSupabaseConfigured } from '../integrations/supabase/client';
import { useAuth } from '../state/AuthContext';
import { colors, radius, rtl, shadows, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectionDiagnostics'>;
type CheckTone = 'ok' | 'warning' | 'failed' | 'skipped' | 'running';

interface CheckItem {
  key: string;
  label: string;
  note: string;
  tone: CheckTone;
}

const SKIPPED_FUNCTION_NOTE = 'לא הופעל כדי לא להריץ ניתוח יקר ללא תמונה. אם נוסיף healthCheck ל-Edge Function, נחבר כאן בדיקה קלה.';

function safeError(error: unknown) {
  if (!error) return 'שגיאה לא ידועה';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  const maybeMessage = error as { message?: unknown; details?: unknown };
  return String(maybeMessage.message ?? maybeMessage.details ?? 'שגיאה לא ידועה');
}

function getToneText(tone: CheckTone) {
  if (tone === 'ok') return 'OK';
  if (tone === 'running') return 'בודק';
  if (tone === 'skipped') return 'דולג';
  if (tone === 'warning') return 'אזהרה';
  return 'נכשל';
}

function getToneStyle(tone: CheckTone) {
  if (tone === 'ok') return styles.okBadge;
  if (tone === 'running') return styles.runningBadge;
  if (tone === 'skipped') return styles.skippedBadge;
  if (tone === 'warning') return styles.warningBadge;
  return styles.failedBadge;
}

export function ConnectionDiagnosticsScreen({ navigation }: Props) {
  const { accountId, session, user } = useAuth();
  const envDiagnostics = useMemo(() => getDeviceEnvironmentDiagnostics(), []);
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<number | undefined>();

  const runChecks = useCallback(async () => {
    setRunning(true);
    const nextChecks: CheckItem[] = [
      {
        key: 'env',
        label: 'כתובת Supabase',
        note: envDiagnostics.supabaseUrl
          ? `${envDiagnostics.supabaseUrl} · ${envDiagnostics.isLocalSupabaseUrl ? 'localhost - לא מתאים לאייפון' : envDiagnostics.isCloudSupabaseUrl ? 'Cloud' : 'כתובת חיצונית'}`
          : 'לא הוגדרה כתובת Supabase.',
        tone: !envDiagnostics.supabaseUrl || envDiagnostics.isLocalSupabaseUrl ? 'failed' : envDiagnostics.isCloudSupabaseUrl ? 'ok' : 'warning',
      },
      {
        key: 'analysis-mode',
        label: 'מצב ניתוח',
        note: `${envDiagnostics.analysisMode} · פונקציה: ${envDiagnostics.analysisFunctionName || 'לא מוגדרת'}`,
        tone: envDiagnostics.isAnalysisModeValid && envDiagnostics.analysisFunctionName ? 'ok' : 'failed',
      },
    ];

    if (!isSupabaseConfigured) {
      nextChecks.push({
        key: 'supabase-config',
        label: 'Supabase client',
        note: 'חסרה תצורה. שאר הבדיקות דולגו.',
        tone: 'failed',
      });
      setChecks(nextChecks);
      setRunning(false);
      setLastRun(Date.now());
      return;
    }

    try {
      const { data, error } = await getSupabaseClient().auth.getSession();
      if (error) throw error;
      nextChecks.push({
        key: 'session',
        label: 'Session',
        note: data.session?.user ? `מחובר כ-${data.session.user.email ?? data.session.user.id}` : 'אין session פעיל.',
        tone: data.session?.user ? 'ok' : 'warning',
      });
    } catch (error) {
      nextChecks.push({ key: 'session', label: 'Session', note: safeError(error), tone: 'failed' });
    }

    try {
      const { data, error } = await getSupabaseClient().auth.getUser();
      if (error) throw error;
      nextChecks.push({
        key: 'user',
        label: 'Auth user',
        note: data.user ? `משתמש מאומת: ${data.user.email ?? data.user.id}` : 'לא נמצא משתמש מאומת.',
        tone: data.user ? 'ok' : 'warning',
      });
    } catch (error) {
      nextChecks.push({ key: 'user', label: 'Auth user', note: safeError(error), tone: 'failed' });
    }

    if (user?.id) {
      try {
        const { data, error } = await getSupabaseClient().from('profiles').select('id,email,full_name').eq('id', user.id).maybeSingle();
        if (error) throw error;
        nextChecks.push({
          key: 'profile',
          label: 'Profile',
          note: data ? `נמצא פרופיל: ${data.email ?? data.full_name ?? data.id}` : 'לא נמצא פרופיל למשתמש.',
          tone: data ? 'ok' : 'warning',
        });
      } catch (error) {
        nextChecks.push({ key: 'profile', label: 'Profile', note: safeError(error), tone: 'failed' });
      }
    } else {
      nextChecks.push({ key: 'profile', label: 'Profile', note: 'דולג כי אין משתמש מחובר.', tone: 'skipped' });
    }

    if (accountId && user?.id) {
      try {
        const { data, error } = await getSupabaseClient()
          .from('account_members')
          .select('account_id,user_id,role')
          .eq('account_id', accountId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (error) throw error;
        nextChecks.push({
          key: 'member',
          label: 'Account membership',
          note: data ? `משויך לחשבון ${accountId}` : 'לא נמצאה חברות בחשבון.',
          tone: data ? 'ok' : 'warning',
        });
      } catch (error) {
        nextChecks.push({ key: 'member', label: 'Account membership', note: safeError(error), tone: 'failed' });
      }
    } else {
      nextChecks.push({ key: 'member', label: 'Account membership', note: 'דולג כי accountId או userId חסרים.', tone: 'skipped' });
    }

    if (accountId) {
      try {
        const { data, error } = await getSupabaseClient().rpc('get_current_account_entitlements', { p_account_id: accountId });
        if (error) throw error;
        nextChecks.push({
          key: 'entitlements',
          label: 'Entitlements RPC',
          note: data ? 'get_current_account_entitlements החזיר נתונים.' : 'ה-RPC חזר ללא נתונים.',
          tone: data ? 'ok' : 'warning',
        });
      } catch (error) {
        nextChecks.push({ key: 'entitlements', label: 'Entitlements RPC', note: safeError(error), tone: 'failed' });
      }

      try {
        const { data, error } = await getSupabaseClient().rpc('can_create_scan', { p_account_id: accountId });
        if (error) throw error;
        nextChecks.push({
          key: 'scan-quota',
          label: 'Scan quota RPC',
          note: data === false ? 'can_create_scan מחזיר חסימה.' : 'can_create_scan מאפשר סריקה.',
          tone: data === false ? 'warning' : 'ok',
        });
      } catch (error) {
        nextChecks.push({ key: 'scan-quota', label: 'Scan quota RPC', note: safeError(error), tone: 'failed' });
      }
    } else {
      nextChecks.push({ key: 'entitlements', label: 'Entitlements RPC', note: 'דולג כי accountId חסר.', tone: 'skipped' });
      nextChecks.push({ key: 'scan-quota', label: 'Scan quota RPC', note: 'דולג כי accountId חסר.', tone: 'skipped' });
    }

    try {
      const { data, error } = await getSupabaseClient().storage.listBuckets();
      if (error) throw error;
      const bucketNames = new Set((data ?? []).map((bucket) => bucket.name));
      nextChecks.push({
        key: 'scan-images',
        label: 'Storage: scan-images',
        note: bucketNames.has(SCAN_IMAGES_BUCKET) ? 'ה-bucket קיים.' : 'לא נמצא ברשימת buckets או שאין הרשאה לראות אותו.',
        tone: bucketNames.has(SCAN_IMAGES_BUCKET) ? 'ok' : 'warning',
      });
      nextChecks.push({
        key: 'pool-images',
        label: 'Storage: pool-images',
        note: bucketNames.has(POOL_IMAGES_BUCKET) ? 'ה-bucket קיים.' : 'לא נמצא ברשימת buckets או שאין הרשאה לראות אותו.',
        tone: bucketNames.has(POOL_IMAGES_BUCKET) ? 'ok' : 'warning',
      });
    } catch (error) {
      const note = `לא ניתן לקרוא רשימת buckets: ${safeError(error)}`;
      nextChecks.push({ key: 'scan-images', label: 'Storage: scan-images', note, tone: 'warning' });
      nextChecks.push({ key: 'pool-images', label: 'Storage: pool-images', note, tone: 'warning' });
    }

    nextChecks.push({
      key: 'edge-function',
      label: 'Edge Function analyze-strip',
      note: `${envDiagnostics.analysisFunctionName || 'analyze-strip'} מוגדרת דרך supabase.functions.invoke. ${SKIPPED_FUNCTION_NOTE}`,
      tone: envDiagnostics.analysisFunctionName ? 'skipped' : 'failed',
    });

    setChecks(nextChecks);
    setRunning(false);
    setLastRun(Date.now());
  }, [accountId, envDiagnostics, user?.id]);

  useEffect(() => {
    runChecks();
  }, [runChecks]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
            <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.kicker}>Expo Go</Text>
            <Text style={styles.title}>בדיקת חיבור</Text>
            <Text style={styles.subtitle}>בדיקות בטוחות למכשיר אמיתי. לא מוצגים מפתחות או תמונות.</Text>
          </View>
        </View>

        {envDiagnostics.warnings.length ? (
          <Card compact style={styles.warningCard}>
            <Text style={styles.warningTitle}>אזהרות תצורה</Text>
            {envDiagnostics.warnings.map((warning) => (
              <Text key={warning} style={styles.warningText}>{warning}</Text>
            ))}
          </Card>
        ) : null}

        <Pressable disabled={running} onPress={runChecks} style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, running && styles.disabled]}>
          {running ? <ActivityIndicator color={colors.white} size="small" /> : <LineIcon name="scan" color={colors.white} size={17} />}
          <Text style={styles.refreshText}>{running ? 'בודק...' : 'הרץ בדיקה מחדש'}</Text>
        </Pressable>

        {lastRun ? <Text style={styles.lastRun}>עודכן: {new Date(lastRun).toLocaleTimeString('he-IL')}</Text> : null}

        <View style={styles.list}>
          {checks.map((check) => (
            <Card compact key={check.key} style={styles.checkCard}>
              <View style={styles.checkHeader}>
                <View style={[styles.badge, getToneStyle(check.tone)]}>
                  <Text style={styles.badgeText}>{getToneText(check.tone)}</Text>
                </View>
                <Text style={styles.checkTitle}>{check.label}</Text>
              </View>
              <Text style={styles.checkNote}>{check.note}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 36 },
  topBar: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  kicker: { color: colors.primaryDark, fontFamily: typography.fontFamilyBold, fontSize: 11, fontWeight: '900', ...rtl.text },
  title: { marginTop: 4, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 23, fontWeight: '900', ...rtl.text },
  subtitle: { marginTop: 6, color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 19, ...rtl.text },
  warningCard: { marginTop: 18, backgroundColor: colors.warningSoft, borderColor: 'rgba(240,165,41,0.35)', gap: 6 },
  warningTitle: { color: colors.warning, fontFamily: typography.fontFamilyBold, fontSize: 13, fontWeight: '900', ...rtl.text },
  warningText: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 18, ...rtl.text },
  refreshButton: { marginTop: 18, minHeight: 50, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 9, ...shadows.button },
  refreshText: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900' },
  lastRun: { marginTop: 10, color: colors.muted, fontFamily: typography.fontFamilyRegular, fontSize: 11, fontWeight: '800', ...rtl.textCenter },
  list: { marginTop: 16, gap: 10 },
  checkCard: { gap: 7 },
  checkHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  checkTitle: { flex: 1, color: colors.text, fontFamily: typography.fontFamilyBold, fontSize: 14, fontWeight: '900', ...rtl.text },
  checkNote: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, fontWeight: '800', lineHeight: 18, ...rtl.text },
  badge: { minWidth: 62, borderRadius: radius.round, paddingHorizontal: 9, paddingVertical: 5, alignItems: 'center' },
  okBadge: { backgroundColor: colors.success },
  warningBadge: { backgroundColor: colors.warning },
  failedBadge: { backgroundColor: colors.danger },
  skippedBadge: { backgroundColor: colors.borderStrong },
  runningBadge: { backgroundColor: colors.primary },
  badgeText: { color: colors.white, fontFamily: typography.fontFamilyBold, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.6 },
});
