import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { Goal, GoalReminderSlot, Reminder } from './types';
import { getActiveGoals } from './goals';
import {
  getActiveReminders,
  getReminderScheduleDates,
  ordinalDay,
  parseReminderTime,
} from './reminders';

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
  await resyncNotificationSchedules();
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
  return parseReminderTime(value);
}

function androidChannel() {
  return Platform.OS === 'android' ? { channelId: 'reminders' } : {};
}

function dateTrigger(date: Date): Notifications.NotificationTriggerInput {
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date,
    ...androidChannel(),
  };
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
    ...androidChannel(),
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
    ...androidChannel(),
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
    ...androidChannel(),
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
          data: { kind: 'goal', goalId: goal.id, screen: '/(tabs)/goals', slotId: slot.id },
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
        data: { kind: 'goal', goalId: goal.id, screen: '/(tabs)/goals' },
      },
      trigger,
    });
  }
}

function reminderBody(reminder: Reminder): string {
  if (reminder.note?.trim()) return reminder.note.trim();
  if (reminder.kind === 'monthly') {
    return `Monthly reminder on the ${ordinalDay(reminder.monthDay ?? 1)}`;
  }
  if (reminder.kind === 'interval') {
    const days = reminder.intervalDays ?? 1;
    return `Every ${days} day${days === 1 ? '' : 's'}`;
  }
  return 'Scheduled reminder';
}

async function scheduleUserReminder(reminder: Reminder): Promise<void> {
  if (!reminder.enabled || !reminder.isActive) return;

  const body = reminderBody(reminder);
  const content = {
    title: reminder.title,
    body,
    sound: true as const,
    data: { kind: 'reminder', reminderId: reminder.id, screen: '/(tabs)/goals' },
  };

  if (reminder.kind === 'monthly') {
    const { hour, minute } = parseTime(reminder.time);
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.MONTHLY,
        day: Math.min(31, Math.max(1, reminder.monthDay ?? 1)),
        hour,
        minute,
        ...androidChannel(),
      },
    });
    return;
  }

  const dates = getReminderScheduleDates(reminder);
  for (const date of dates) {
    await Notifications.scheduleNotificationAsync({
      content,
      trigger: dateTrigger(date),
    });
  }
}

export async function resyncNotificationSchedules() {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const goals = await getActiveGoals();
  for (const goal of goals) {
    await scheduleGoalReminders(goal);
  }
  const reminders = await getActiveReminders();
  for (const reminder of reminders) {
    await scheduleUserReminder(reminder);
  }
}

export async function syncGoalReminderSchedules(_goals?: Goal[]) {
  await resyncNotificationSchedules();
}

export async function syncGoalReminderSchedulesFromStorage() {
  await resyncNotificationSchedules();
}
