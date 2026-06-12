import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from './Card';
import { LineIcon } from './LineIcon';
import { colors, rtl, typography } from '../theme';
import type { RootStackParamList } from '../../App';

interface StaticInfoScreenProps {
  navigation: { navigate: (screen: keyof RootStackParamList) => void };
  title: string;
  subtitle?: string;
  sections: {
    body: string;
    title: string;
  }[];
}

export function StaticInfoScreen({ navigation, sections, subtitle, title }: StaticInfoScreenProps) {
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.navigate('Settings')} style={styles.iconButton}>
            <LineIcon name="chevronLeft" color={colors.primaryDark} size={18} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>

        <View style={styles.sections}>
          {sections.map((section) => (
            <Card compact key={section.title} style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionText}>{section.body}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 44,
    paddingBottom: 42,
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 22,
    fontWeight: '900',
    ...rtl.text,
  },
  subtitle: {
    marginTop: 4,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    ...rtl.text,
  },
  sections: {
    marginTop: 18,
    gap: 12,
  },
  sectionCard: {
    gap: 6,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.text,
  },
  sectionText: {
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    ...rtl.text,
  },
});
