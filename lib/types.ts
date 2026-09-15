import { format } from 'date-fns';

export type Category = string;

/** How an expense was paid. Older records without this field count as cash. */
export type PaidWith = 'cash' | 'online';

export interface Transaction {
  id?: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  category?: Category;
  type: 'income' | 'expense';
  /** Only used for expenses. Missing values are treated as cash. */
  paidWith?: PaidWith;
}

export interface UserProfile {
  name: string;
  email?: string;
  currency: string;
  /** Optional avatar (remote URL or `file://` after picking an image). */
  avatarUri?: string;
}

export interface MonthData {
  income: Transaction[];
  expenses: Transaction[];
}

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';

export interface GoalReminderSlot {
  id: string;
  label?: string;
  time: string; // HH:mm
}

export interface Goal {
  id: string;
  title: string;
  emoji?: string;
  targetCount: number;
  completedCount: number;
  period: GoalPeriod;
  reminderEnabled: boolean;
  remindersPerPeriod: number;
  reminderTime: string; // HH:mm
  reminderSlots?: GoalReminderSlot[];
  periodAnchor: string; // ISO string used to detect period rollover
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface GoalProgressEntry {
  id: string;
  goalId: string;
  dateKey: string; // yyyy-MM-dd
  count: number;
  updatedAt: string;
}

/** One-time date, same calendar day each month, or every N days. */
export type ReminderKind = 'once' | 'monthly' | 'interval';

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  kind: ReminderKind;
  /** Time of day as HH:mm */
  time: string;
  /** ISO datetime for one-time reminders */
  fireAt?: string;
  /** Day of month 1-31 for monthly reminders */
  monthDay?: number;
  /** Repeat every N days for interval reminders */
  intervalDays?: number;
  /** When the current interval clock started */
  intervalStartAt?: string;
  /** Set when the user marks an interval reminder done */
  lastCompletedAt?: string;
  enabled: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const getMonthKey = (date: Date) => `data_${format(date, 'yyyy_MM')}`;



export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  INR: '₹',
  CAD: 'CA$',
  AUD: 'A$',
  CNY: 'CN¥',
  PKR: '₨',
  AED: 'د.إ',
  SAR: '﷼',
  SGD: 'S$',
  BRL: 'R$',
  RUB: '₽',
  TRY: '₺',
  KRW: '₩',
};
