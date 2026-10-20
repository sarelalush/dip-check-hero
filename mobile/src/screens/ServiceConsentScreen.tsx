import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useLegalConsent } from '../state/LegalConsentContext';
import { useAuth } from '../state/AuthContext';
import { legalDocuments } from '../services/legalConsentService';
import { PrimaryButton } from '../components/PrimaryButton';
import { AiConsentPanel } from '../components/AiConsentPanel';
import { colors, rtl, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ServiceConsent'>;
export function ServiceConsentScreen({ navigation }: Props) {
  const { status, checking, error, failureKind, accept, refresh } = useLegalConsent();
  const { signOut } = useAuth();
  const [terms, setTerms] = useState(false);
  const [scope, setScope] = useState(false);
  const showConsent = Boolean(status?.releaseReady && !status.deletionPending && failureKind !== 'service_update');
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.title}>לפני המשך השימוש</Text>
    <Text style={styles.body}>השירות מעריך מדדים מסריקת סטיק ומציע מנות תחזוקה חלקיות כשיש מספיק נתונים לחישוב נתמך. אין הזנה ידנית של מדדי מים. השירות אינו בדיקת מעבדה או אישור רחצה. אחרי טיפול נדרשת סריקה חדשה.</Text>
    {!showConsent ? <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{status?.deletionPending ? 'בקשת המחיקה שלך בטיפול'
        : checking ? 'בודקים את זמינות השירות'
        : failureKind === 'service_update' || status?.releaseReady === false ? 'השירות החדש עדיין לא זמין'
        : 'לא ניתן לאמת את זמינות השירות'}</Text>
      <Text style={styles.body}>אפשר לצפות בדוגמה ובמדדים השמורים ולנהל את המנוי. ניתוח חדש ואישור התנאים אינם זמינים כרגע.</Text>
      <PrimaryButton label="צפייה בדוגמה" onPress={() => navigation.navigate('DemoResult')} />
    </View> : null}
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('SavedMeasurements')}><Text style={styles.link}>צפייה במדדים שמורים וניהול מנוי</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => navigation.navigate('Terms')}><Text style={styles.link}>תנאי השימוש — גרסה {legalDocuments.version}</Text></Pressable>
    <Pressable accessibilityRole="link" onPress={() => navigation.navigate('PrivacyPolicy')}><Text style={styles.link}>מדיניות הפרטיות</Text></Pressable>
    {showConsent ? <>
      <Choice value={terms} onChange={() => setTerms(!terms)} label="אני מסכים/ה לתנאי השימוש. מידע על שימוש בנתונים מופיע במדיניות הפרטיות." />
      <Choice value={scope} onChange={() => setScope(!scope)} label="אני בגיר/ה והשימוש שלי מיועד לבריכה ביתית פרטית בישראל." />
      <Text style={styles.body}>הסכמה לניתוח תמונה ב־Google Gemini תתבקש בנפרד לפני הסריקה.</Text>
      <PrimaryButton label="אישור והמשך" busy={checking} disabled={!terms || !scope || checking}
        onPress={() => { void accept().catch(() => {}); }} />
    </> : null}
    {status?.aiAllowed ? <AiConsentPanel onPrivacy={() => navigation.navigate('PrivacyPolicy')} /> : null}
    {error && failureKind !== 'service_update' ? <Text accessibilityLiveRegion="polite" style={styles.body}>{error}</Text> : null}
    <Pressable accessibilityRole="button" onPress={() => { void refresh().catch(() => {}); }}><Text style={styles.link}>בדוק שוב את זמינות השירות</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('DeleteAccount')}><Text style={styles.link}>מחיקת חשבון</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Support')}><Text style={styles.link}>עזרה ותמיכה</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { void signOut(); }}><Text style={styles.link}>חזרה למסך הכניסה</Text></Pressable>
  </ScrollView>;
}
function Choice({value, onChange, label}: {value:boolean;onChange:()=>void;label:string}) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{checked:value}} onPress={onChange} style={styles.choice}>
    <View style={styles.box}><Text>{value ? '✓' : ''}</Text></View><Text style={[styles.body,{flex:1}]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  content:{padding:24,paddingTop:54,gap:18,backgroundColor:colors.background,flexGrow:1},
  title:{fontFamily:typography.fontFamilyBold,fontSize:24,color:colors.text,...rtl.text},
  body:{fontFamily:typography.fontFamilyRegular,fontSize:14,lineHeight:23,color:colors.textSoft,...rtl.text},
  notice:{padding:18,gap:12,backgroundColor:colors.surface,borderRadius:18,borderWidth:1,borderColor:colors.border},
  noticeTitle:{fontFamily:typography.fontFamilyBold,fontSize:18,color:colors.text,...rtl.text},
  link:{fontFamily:typography.fontFamilyBold,fontSize:14,color:colors.primary,paddingVertical:8,...rtl.text},
  choice:{...rtl.row,alignItems:'center',gap:12},
  box:{width:26,height:26,borderColor:colors.primary,borderWidth:2,borderRadius:5,alignItems:'center',justifyContent:'center'},
});
