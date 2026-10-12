import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLegalConsent } from '../state/LegalConsentContext';
import { legalDocuments } from '../services/legalConsentService';
import { PrimaryButton } from './PrimaryButton';
import { colors, rtl, typography } from '../theme';
export function AiConsentPanel({ onPrivacy }: { onPrivacy: () => void }) {
  const { status, checking, error, chooseAi } = useLegalConsent();
  return <View style={styles.panel}>
    <Text style={styles.title}>{legalDocuments.ai.title}</Text>
    <Text style={styles.text}>{legalDocuments.ai.sections[0].body}</Text>
    <Pressable accessibilityRole="link" onPress={onPrivacy}><Text style={styles.link}>פירוט במדיניות הפרטיות</Text></Pressable>
    <PrimaryButton busy={checking} disabled={checking || (!status?.aiAllowed && (!status?.serviceAccepted || !status.releaseReady))}
      label={status?.aiAllowed ? 'ביטול הסכמה לניתוח AI' : 'אני מסכים/ה לניתוח באמצעות Gemini'}
      onPress={() => { void chooseAi(!status?.aiAllowed).catch(() => {}); }} />
    {!status?.aiAllowed ? <Text style={styles.text}>אפשר לסרב ולחזור ללא ניתוח חדש. התמונה לא תישלח ל־Gemini ללא הסכמה.</Text> : null}
    {error ? <Text accessibilityLiveRegion="polite" style={styles.text}>{error}</Text> : null}
  </View>;
}
const styles=StyleSheet.create({
  panel:{padding:16,gap:12,backgroundColor:colors.surface,borderRadius:18,borderWidth:1,borderColor:colors.border},
  title:{fontFamily:typography.fontFamilyBold,fontSize:17,color:colors.text,...rtl.text},
  text:{fontFamily:typography.fontFamilyRegular,fontSize:13,lineHeight:22,color:colors.textSoft,...rtl.text},
  link:{fontFamily:typography.fontFamilyBold,color:colors.primary,fontSize:13,...rtl.text},
});
