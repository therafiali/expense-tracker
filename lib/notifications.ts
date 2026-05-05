import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should be handled when the app is running
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  
  if (finalStatus !== 'granted') {
    return false;
  }
  
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#A5E8FD',
    });
  }
  
  return true;
}

export async function scheduleDailyReminder() {
  // First, cancel any existing reminders to avoid duplicates
  await Notifications.cancelAllScheduledNotificationsAsync();

  // Schedule for 8:00 PM every day
  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: 20,
    minute: 0,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "💰 Time to track your spending!",
      body: "Don't forget to add today's expenses to WalletWatch.",
      sound: true,
      data: { url: '/add-expense' },
    },
    trigger,
  });
  
  console.log('Daily reminder scheduled for 20:00');
}

export async function testNotification() {
  const trigger: Notifications.NotificationTriggerInput = {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 5,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  };

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "WalletWatch Test 🚀",
      body: "If you see this, notifications are working!",
    },
    trigger,
  });
}
