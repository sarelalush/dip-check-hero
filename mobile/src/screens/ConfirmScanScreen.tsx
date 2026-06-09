import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppShell } from '../components/AppShell';
import { Card } from '../components/Card';
import { LineIcon } from '../components/LineIcon';
import { PrimaryButton } from '../components/PrimaryButton';
import { colors, radius, rtl, shadows, spacing, typography } from '../theme';
import type { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ConfirmScan'>;

const checklistItems = ['הסטיק חד וברור', 'כל ריבועי הצבע נראים', 'התאורה טובה'];

export function ConfirmScanScreen({ navigation, route }: Props) {
  const { brandId, imageUri, poolId } = route.params;

  function continueToResults() {
    navigation.navigate('Results', {
      brandId,
      imageUri,
      poolId,
    });
  }

  function retakeImage() {
    navigation.goBack();
  }

  return (
    <AppShell activeTab="scan" navigation={navigation}>
      <View style={styles.header}>
        <Text style={styles.title}>אישור תמונה</Text>
        <Text style={styles.subtitle}>ודאו שהסטיק ברור ומופיע בתוך המסגרת</Text>
      </View>

      <Card style={styles.previewCard}>
        <View style={styles.previewFrame}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
        </View>
        <View style={styles.previewPill}>
          <LineIcon name="check" color={colors.success} size={14} />
          <Text style={styles.previewPillText}>תמונה מוכנה לבדיקה</Text>
        </View>
      </Card>

      <Card compact style={styles.checklistCard}>
        {checklistItems.map((item) => (
          <View key={item} style={styles.checkRow}>
            <View style={styles.checkIcon}>
              <LineIcon name="check" color={colors.success} size={14} />
            </View>
            <Text style={styles.checkText}>{item}</Text>
          </View>
        ))}
      </Card>

      <View style={styles.actions}>
        <PrimaryButton label="המשך לניתוח" icon="results" onPress={continueToResults} />
        <Pressable onPress={retakeImage} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
          <LineIcon name="camera" color={colors.primaryDark} size={17} />
          <Text style={styles.secondaryButtonText}>צילום מחדש / החלפת תמונה</Text>
        </Pressable>
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  header: {
    marginTop: 18,
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontFamily: typography.fontFamilyBold,
    fontSize: 21,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  subtitle: {
    marginTop: 7,
    color: colors.textSoft,
    fontFamily: typography.fontFamilyRegular,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 19,
    ...rtl.textCenter,
  },
  previewCard: {
    marginTop: 18,
    padding: spacing.md,
    alignItems: 'center',
    gap: 12,
  },
  previewFrame: {
    width: '100%',
    aspectRatio: 0.86,
    maxHeight: 350,
    borderRadius: radius.xl,
    backgroundColor: colors.backgroundDeep,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  corner: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderColor: colors.white,
  },
  topRight: {
    top: 12,
    right: 12,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: radius.md,
  },
  topLeft: {
    top: 12,
    left: 12,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: radius.md,
  },
  bottomRight: {
    bottom: 12,
    right: 12,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: radius.md,
  },
  bottomLeft: {
    bottom: 12,
    left: 12,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: radius.md,
  },
  previewPill: {
    minHeight: 34,
    borderRadius: radius.round,
    backgroundColor: colors.successSoft,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  previewPillText: {
    color: colors.success,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 12,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  checklistCard: {
    marginTop: 12,
    gap: 10,
  },
  checkRow: {
    minHeight: 34,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
    color: colors.text,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 13,
    fontWeight: '900',
    ...rtl.text,
  },
  actions: {
    marginTop: 16,
    gap: 11,
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    ...shadows.soft,
  },
  secondaryButtonText: {
    color: colors.primaryDeep,
    fontFamily: typography.fontFamilySemiBold,
    fontSize: 14,
    fontWeight: '900',
    ...rtl.textCenter,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
