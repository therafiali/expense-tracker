import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDays,
  addMonths,
  format,
  isValid,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
} from 'date-fns';
import type { Reminder, ReminderKind } from './types';

const REMINDERS_STORAGE_KEY = 'reminders_v1';
const INTERVAL_SCHEDULE_COUNT = 6;

function generateReminderId(): string {
  return 'reminder-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function parseReminderTime(value: string): { hour: number; minute: number } {
  const [h, m] = value.split(':').map((part) => Number(part));
  const hour = Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 9;
  const minute = Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0;
  return { hour, minute };
}

export function applyTime(date: Date, time: string): Date {
  const { hour, minute } = parseReminderTime(time);
  let next = setHours(date, hour);
  next = setMinutes(next, minute);
  next = setSeconds(next, 0);
  next = setMilliseconds(next, 0);
  return next;
}

function safeDate(value?: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return isValid(parsed) ? parsed : null;
}

function clampMonthDay(day?: number): number {
  if (!Number.isFinite(day)) return 1;
  return Math.min(31, Math.max(1, Math.floor(day as number)));
}

function clampIntervalDays(days?: number): number {
  if (!Number.isFinite(days)) return 1;
  return Math.min(365, Math.max(1, Math.floor(days as number)));
}

function intervalAnchor(reminder: Reminder): Date {
  return (
    safeDate(reminder.lastCompletedAt) ??
    safeDate(reminder.intervalStartAt) ??
    safeDate(reminder.createdAt) ??
    new Date()
  );
}

/** Current due datetime. May be in the past (overdue) for interval reminders. */
export function getReminderDueAt(reminder: Reminder, now = new Date()): Date | null {
  if (reminder.kind === 'once') {
    return safeDate(reminder.fireAt);
  }

  if (reminder.kind === 'monthly') {
    const day = clampMonthDay(reminder.monthDay);
    const withTime = (base: Date) => applyTime(new Date(base.getFullYear(), base.getMonth(), day), reminder.time);

    let candidate = withTime(now);
    if (candidate.getDate() !== day) {
      candidate = withTime(addMonths(now, 1));
    }
    if (candidate.getTime() <= now.getTime()) {
      candidate = withTime(addMonths(now, 1));
      if (candidate.getDate() !== day) {
        candidate = withTime(addMonths(now, 2));
      }
    }
    return candidate;
  }

  const days = clampIntervalDays(reminder.intervalDays);
  return applyTime(addDays(intervalAnchor(reminder), days), reminder.time);
}

export function isReminderOverdue(reminder: Reminder, now = new Date()): boolean {
  if (reminder.kind === 'monthly') return false;
  const due = getReminderDueAt(reminder, now);
  if (!due) return false;
  return due.getTime() <= now.getTime();
}

/** Future fire times to register with the OS. */
export function getReminderScheduleDates(reminder: Reminder, now = new Date()): Date[] {
  if (!reminder.enabled || !reminder.isActive) return [];

  if (reminder.kind === 'once') {
    const due = getReminderDueAt(reminder, now);
    if (!due || due.getTime() <= now.getTime()) return [];
    return [due];
  }

  if (reminder.kind === 'monthly') {
    const due = getReminderDueAt(reminder, now);
    return due && due.getTime() > now.getTime() ? [due] : [];
  }

  const due = getReminderDueAt(reminder, now);
  if (!due) return [];
  const days = clampIntervalDays(reminder.intervalDays);
  const dates: Date[] = [];
  let cursor = due;
  while (cursor.getTime() <= now.getTime()) {
    cursor = applyTime(addDays(cursor, days), reminder.time);
  }
  for (let i = 0; i < INTERVAL_SCHEDULE_COUNT; i += 1) {
    dates.push(cursor);
    cursor = applyTime(addDays(cursor, days), reminder.time);
  }
  return dates;
}

export function reminderKindLabel(kind: ReminderKind): string {
  if (kind === 'once') return 'One time';
  if (kind === 'monthly') return 'Every month';
  return 'Every few days';
}

export function formatReminderTime(time: string): string {
  return format(applyTime(new Date(), time), 'h:mm a');
}

export function formatReminderSchedule(reminder: Reminder, now = new Date()): string {
  const due = getReminderDueAt(reminder, now);
  const timeLabel = formatReminderTime(reminder.time);

  if (reminder.kind === 'once') {
    if (!due) return 'No date set';
    return format(due, "EEE, d MMM yyyy 'at' h:mm a");
  }

  if (reminder.kind === 'monthly') {
    return `Every month on the ${ordinalDay(reminder.monthDay ?? 1)} at ${timeLabel}`;
  }

  const days = reminder.intervalDays ?? 1;
  const every = `Every ${days} day${days === 1 ? '' : 's'}`;
  if (due && due.getTime() <= now.getTime()) {
    return `${every} • Overdue since ${format(due, 'd MMM')}`;
  }
  return `${every} • Next ${due ? format(due, 'd MMM') : ''} at ${timeLabel}`;
}

export function sortReminders(reminders: Reminder[]): Reminder[] {
  return [...reminders].sort((a, b) => {
    const aOverdue = isReminderOverdue(a) ? 0 : 1;
    const bOverdue = isReminderOverdue(b) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;
    const aDue = getReminderDueAt(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bDue = getReminderDueAt(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return aDue - bDue;
  });
}

export function ordinalDay(day: number): string {
  const n = clampMonthDay(day);
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export async function getReminders(): Promise<Reminder[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error fetching reminders:', error);
    return [];
  }
}

async function saveReminders(reminders: Reminder[]): Promise<void> {
  await AsyncStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
}

export async function getActiveReminders(): Promise<Reminder[]> {
  const reminders = await getReminders();
  return reminders.filter((reminder) => reminder.isActive);
}

export async function getReminderById(id: string): Promise<Reminder | null> {
  const reminders = await getActiveReminders();
  return reminders.find((reminder) => reminder.id === id) ?? null;
}

export interface UpsertReminderInput {
  id?: string;
  title: string;
  note?: string;
  kind: ReminderKind;
  time: string;
  fireAt?: string;
  monthDay?: number;
  intervalDays?: number;
  enabled?: boolean;
  isActive?: boolean;
}

export async function upsertReminder(input: UpsertReminderInput): Promise<Reminder> {
  const nowIso = new Date().toISOString();
  const reminders = await getReminders();
  const title = input.title.trim();
  const time = input.time.trim() || '09:00';

  if (input.id) {
    const idx = reminders.findIndex((reminder) => reminder.id === input.id);
    if (idx >= 0) {
      const existing = reminders[idx];
      const next: Reminder = {
        ...existing,
        title,
        note: input.note?.trim() || undefined,
        kind: input.kind,
        time,
        fireAt: input.kind === 'once' ? input.fireAt : undefined,
        monthDay: input.kind === 'monthly' ? clampMonthDay(input.monthDay) : undefined,
        intervalDays: input.kind === 'interval' ? clampIntervalDays(input.intervalDays) : undefined,
        intervalStartAt:
          input.kind === 'interval'
            ? existing.kind === 'interval'
              ? existing.intervalStartAt
              : nowIso
            : undefined,
        lastCompletedAt: input.kind === 'interval' ? existing.lastCompletedAt : undefined,
        enabled: input.enabled ?? existing.enabled,
        isActive: input.isActive ?? true,
        updatedAt: nowIso,
      };
      reminders[idx] = next;
      await saveReminders(reminders);
      return next;
    }
  }

  const reminder: Reminder = {
    id: generateReminderId(),
    title,
    note: input.note?.trim() || undefined,
    kind: input.kind,
    time,
    fireAt: input.kind === 'once' ? input.fireAt : undefined,
    monthDay: input.kind === 'monthly' ? clampMonthDay(input.monthDay) : undefined,
    intervalDays: input.kind === 'interval' ? clampIntervalDays(input.intervalDays) : undefined,
    intervalStartAt: input.kind === 'interval' ? nowIso : undefined,
    enabled: input.enabled ?? true,
    isActive: input.isActive ?? true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await saveReminders([reminder, ...reminders]);
  return reminder;
}

export async function markReminderDone(id: string): Promise<Reminder | null> {
  const nowIso = new Date().toISOString();
  const reminders = await getReminders();
  const idx = reminders.findIndex((reminder) => reminder.id === id);
  if (idx < 0) return null;

  const existing = reminders[idx];
  if (existing.kind !== 'interval') return existing;

  const next: Reminder = {
    ...existing,
    lastCompletedAt: nowIso,
    intervalStartAt: nowIso,
    updatedAt: nowIso,
  };
  reminders[idx] = next;
  await saveReminders(reminders);
  return next;
}

export async function archiveReminder(id: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const reminders = await getReminders();
  const updated = reminders.map((reminder) =>
    reminder.id === id ? { ...reminder, isActive: false, updatedAt: nowIso } : reminder,
  );
  await saveReminders(updated);
}
