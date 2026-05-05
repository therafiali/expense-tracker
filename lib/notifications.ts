import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Goal, GoalReminderSlot } from './types';
import { getActiveGoals } from './goals';

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
  await syncGoalReminderSchedulesFromStorage();
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

function parseTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map((part) => Number(part));
  const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
  const minute = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  return { hour, minute };
}

function makeTitle(goal: Goal) {
  const icon = goal.emoji?.trim() || '⏰';
  return `${icon} ${goal.title}`;
}

function makeBody(goal: Goal) {
  if (goal.period === 'daily') return `Goal: ${goal.targetCount} times today`;
  if (goal.period === 'weekly') return `Goal: ${goal.targetCount} times this week`;
  return `Goal: ${goal.targetCount} times this month`;
}

function dailyTrigger(hour: number, minute: number): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour,
    minute,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  };
}

function slotTitle(goal: Goal, slot?: GoalReminderSlot) {
  if (!slot?.label?.trim()) return makeTitle(goal);
  return `${makeTitle(goal)} - ${slot.label.trim()}`;
}

function weeklyTrigger(
  hour: number,
  minute: number,
  weekday: number,
): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday,
    hour,
    minute,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  } as Notifications.NotificationTriggerInput;
}

function monthlyTrigger(
  hour: number,
  minute: number,
  day: number,
): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
    day,
    hour,
    minute,
    repeats: true,
    ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
  } as Notifications.NotificationTriggerInput;
}

function getSteps(remindersPerPeriod: number, max: number): number[] {
  const total = Math.max(1, remindersPerPeriod);
  if (total === 1) return [0];
  const step = Math.max(1, Math.floor(max / total));
  return Array.from({ length: total }, (_, index) => (index * step) % max);
}

async function scheduleGoalReminders(goal: Goal): Promise<void> {
  if (!goal.reminderEnabled || !goal.isActive) return;

  const customSlots = (goal.reminderSlots ?? []).filter((slot) => slot.time?.trim().length > 0);
  if (customSlots.length > 0) {
    for (const slot of customSlots) {
      const { hour, minute } = parseTime(slot.time);
      const trigger =
        goal.period === 'daily'
          ? dailyTrigger(hour, minute)
          : goal.period === 'weekly'
            ? weeklyTrigger(hour, minute, 1)
            : monthlyTrigger(hour, minute, 1);

      await Notifications.scheduleNotificationAsync({
        content: {
          title: slotTitle(goal, slot),
          body: makeBody(goal),
          sound: true,
          data: { goalId: goal.id, screen: '/(tabs)/goals', slotId: slot.id },
        },
        trigger,
      });
    }
    return;
  }

  const { hour, minute } = parseTime(goal.reminderTime);
  const steps = getSteps(
    goal.remindersPerPeriod,
    goal.period === 'monthly' ? 28 : goal.period === 'weekly' ? 7 : 24,
  );

  for (const offset of steps) {
    const trigger =
      goal.period === 'daily'
        ? dailyTrigger((hour + offset) % 24, minute)
        : goal.period === 'weekly'
          ? weeklyTrigger(hour, minute, ((offset % 7) + 1) as number)
          : monthlyTrigger(hour, minute, Math.min(28, offset + 1));

    await Notifications.scheduleNotificationAsync({
      content: {
        title: makeTitle(goal),
        body: makeBody(goal),
        sound: true,
        data: { goalId: goal.id, screen: '/(tabs)/goals' },
      },
      trigger,
    });
  }
}

export async function syncGoalReminderSchedules(goals: Goal[]) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const goal of goals) {
    await scheduleGoalReminders(goal);
  }
}

export async function syncGoalReminderSchedulesFromStorage() {
  const goals = await getActiveGoals();
  await syncGoalReminderSchedules(goals);
}
