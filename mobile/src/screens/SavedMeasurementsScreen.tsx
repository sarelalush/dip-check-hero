import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../App';
import { useResultsHistory } from '../state/ResultsHistoryContext';
import { MEASUREMENT_SAFETY_NOTE } from '../domain/dosage';
import { SubscriptionManagementLinks } from '../components/SubscriptionManagementLinks';
import { colors, rtl, typography } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedMeasurements'>;
// Existing measurements and cancellation remain accessible while new service
// use is blocked. This screen has no camera, upload, purchase or treatment path.
export function SavedMeasurementsScreen({ navigation }: Props) {
  const { historyRecords, isHydrated, syncing, syncError, refreshHistory } = useResultsHistory();
  return <ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => navigation.goBack()}><Text style={styles.link}>חזרה</Text></Pressable>
    <Text style={styles.title}>מדדים שמורים</Text>
    <Text style={styles.body}>{MEASUREMENT_SAFETY_NOTE}</Text>
    {!isHydrated || syncing ? <Text style={styles.body}>טוען בדיקות שמורות...</Text> : null}
    {syncError ? <Text style={styles.body}>{syncError}</Text> : null}
    {isHydrated && !historyRecords.length ? <Text style={styles.body}>אין בדיקות שמורות להצגה.</Text> : null}
    {historyRecords.map((record) => <View key={record.testId} style={styles.card}>
      <Text style={styles.name}>{record.poolName}</Text>
      <Text style={styles.body}>{record.date} · {record.brandName}</Text>
      {(record.analysisResult?.parameters ?? []).filter((p) => Number.isFinite(p.value)).map((p) =>
        <Text key={p.key} style={styles.body}>{p.name}: {p.value} {p.unit} · מדידה שמורה</Text>)}
      {!record.analysisResult?.parameters.length ? <Text style={styles.body}>פרטי המדדים אינם זמינים ברשומה זו.</Text> : null}
    </View>)}
    <Pressable accessibilityRole="button" onPress={() => { void refreshHistory().catch(() => {}); }}><Text style={styles.link}>רענון מדדים שמורים</Text></Pressable>
    <Text style={styles.body}>חסימת ניתוחים או מחיקת חשבון אינן מבטלות מנוי. לניהול החידוש השתמש בחנות שבה רכשת; לבירור חיובים או החזר פנה לתמיכה.</Text>
    <SubscriptionManagementLinks />
    <Pressable accessibilityRole="button" onPress={() => navigation.navigate('Support')}><Text style={styles.link}>עזרה ובירור חיובים</Text></Pressable>
  </ScrollView>;
}
const styles = StyleSheet.create({
  content:{padding:24,paddingTop:54,gap:16,backgroundColor:colors.background,flexGrow:1},
  title:{fontFamily:typography.fontFamilyBold,fontSize:24,color:colors.text,...rtl.text},
  name:{fontFamily:typography.fontFamilyBold,fontSize:17,color:colors.text,...rtl.text},
  body:{fontFamily:typography.fontFamilyRegular,fontSize:14,lineHeight:23,color:colors.textSoft,...rtl.text},
  link:{fontFamily:typography.fontFamilyBold,fontSize:14,color:colors.primary,paddingVertical:8,...rtl.text},
  card:{padding:16,gap:8,backgroundColor:colors.surface,borderRadius:18},
});
