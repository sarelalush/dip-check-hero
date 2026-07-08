import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

export type ReminderNotificationFrequency = 'off' | 'every3h' | 'every6h' | 'every12h' | 'daily';

interface ScheduleReminderInput {
  frequency: Exclude<ReminderNotificationFrequency, 'off'>;
  poolId: string;
  poolName: string;
}

export interface ScheduleReminderResult {
  error?: string;
  notificationId?: string;
}

const REMINDER_CHANNEL_ID = 'pool-test-reminders';

const FREQUENCY_SECONDS: Record<Exclude<ReminderNotificationFrequency, 'off'>, number> = {
  every3h: 3 * 60 * 60,
  every6h: 6 * 60 * 60,
  every12h: 12 * 60 * 60,
  daily: 24 * 60 * 60,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function ensureReminderChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: 'תזכורות בדיקת בריכה',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#08AFCB',
  });
}

async function ensureNotificationPermission() {
  if (Platform.OS === 'web') {
    return { granted: false, error: 'התראות נתמכות רק באפליקציה המותקנת במכשיר.' };
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return { granted: true };

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: false,
      allowSound: true,
    },
  });

  if (requested.granted) return { granted: true };
  return { granted: false, error: 'לא ניתנה הרשאה לשליחת התראות במכשיר.' };
}

export async function cancelPoolReminderNotification(notificationId?: string) {
  if (!notificationId || Platform.OS === 'web') return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Failed to cancel pool reminder notification', error);
  }
}

export async function schedulePoolReminderNotification({
  frequency,
  poolId,
  poolName,
}: ScheduleReminderInput): Promise<ScheduleReminderResult> {
  try {
    const permission = await ensureNotificationPermission();
    if (!permission.granted) {
      return { error: permission.error };
    }

    await ensureReminderChannel();

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'זמן לבדוק את הבריכה',
        body: `מומלץ לבצע בדיקת סטיק עבור ${poolName}.`,
        data: {
          poolId,
          type: 'pool-test-reminder',
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: FREQUENCY_SECONDS[frequency],
        repeats: true,
        channelId: REMINDER_CHANNEL_ID,
      },
    });

    return { notificationId };
  } catch (error) {
    console.warn('Failed to schedule pool reminder notification', error);
    return { error: 'לא הצלחנו להפעיל התראה במכשיר. אפשר להמשיך להשתמש באפליקציה כרגיל.' };
  }
}
