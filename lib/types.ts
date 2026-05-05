import { format } from 'date-fns';

export type Category = string;

export interface Transaction {
  id?: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  category?: Category;
  type: 'income' | 'expense';
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
