import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { GUIDANCE_SOURCES } from '../domain/metricGuidance';
import { colors, rtl, typography } from '../theme';
import { DisclosureSection } from './DisclosureSection';

export function GuidanceSources() {
  return (
    <DisclosureSection title="על ההנחיות והמקורות" summary="מידע כללי לבדיקת מים ותחזוקה">
      <Text style={styles.text}>
        ההנחיות מסבירות את המדדים ואת כיוון הבירור. הן אינן תוכנית טיפול מותאמת לבריכה.
        המקורות כוללים מידע מ־CDC ומיצרני ציוד בדיקה; טווח ההשוואה אינו תקן ישראלי או אישור רחצה.
      </Text>
      {GUIDANCE_SOURCES.map((source) => (
        <Pressable key={source.url} accessibilityRole="link" style={styles.link}
          onPress={() => { void Linking.openURL(source.url).catch(() => {}); }}>
          <Text style={styles.linkText}>{source.label}</Text>
        </Pressable>
      ))}
    </DisclosureSection>
  );
}

const styles = StyleSheet.create({
  text: { color: colors.textSoft, fontFamily: typography.fontFamilyRegular, fontSize: 12, lineHeight: 20, ...rtl.text },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: colors.primaryDeep, fontFamily: typography.fontFamilySemiBold, fontSize: 13, ...rtl.text },
});
