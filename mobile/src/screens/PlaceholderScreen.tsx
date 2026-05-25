import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export function PlaceholderScreen({ title }: { title: string }) {
  return (
    <View style={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>נחבר את המסך הזה בשלב הבא לפי הלוגיקה שכבר קיימת בגרסת הווב.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: '900',
    textAlign: 'right',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'right',
    marginTop: 10,
  },
});
