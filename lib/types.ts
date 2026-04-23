import { format } from 'date-fns';

export type Category = 'Food' | 'Petrol' | 'Repair' | 'Shopping' | 'Course' | 'Education' | 'Other';

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
}

export interface MonthData {
  income: Transaction[];
  expenses: Transaction[];
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
