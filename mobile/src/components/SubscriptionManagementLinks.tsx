import { Linking, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { colors, rtl, typography } from '../theme';

export function SubscriptionManagementLinks() {
  const stores = [
    { platform: 'ios', name: 'Apple', url: 'https://apps.apple.com/account/subscriptions' },
    { platform: 'android', name: 'Google Play', url: 'https://play.google.com/store/account/subscriptions' },
  ].filter((store) => Platform.OS === 'web' || Platform.OS === store.platform);
  return <>{stores.map((store) => <Pressable key={store.platform} accessibilityRole="link"
    onPress={() => { void Linking.openURL(store.url); }}>
    <Text style={styles.link}>ניהול וביטול מנוי ב־{store.name}</Text>
  </Pressable>)}</>;
}
const styles = StyleSheet.create({
  link:{fontFamily:typography.fontFamilyBold,fontSize:14,color:colors.primary,paddingVertical:8,...rtl.text},
});
