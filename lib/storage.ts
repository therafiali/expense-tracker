import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

export type Category = 'Food' | 'Petrol' | 'Repair' | 'Shopping' | 'Course' | 'Education' | 'Other';

export interface Transaction {
  id: string;
  amount: number;
  date: string; // ISO string
  note?: string;
  category?: Category;
  type: 'income' | 'expense';
}

export interface MonthData {
  income: Transaction[];
  expenses: Transaction[];
}

export const getMonthKey = (date: Date) => `data_${format(date, 'yyyy_MM')}`;

export const getMonthData = async (date: Date): Promise<MonthData> => {
  try {
    const key = getMonthKey(date);
    const data = await AsyncStorage.getItem(key);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error fetching data:', error);
  }
  return { income: [], expenses: [] };
};

export const saveTransaction = async (date: Date, transaction: Transaction) => {
  const key = getMonthKey(date);
  const data = await getMonthData(date);
  
  if (transaction.type === 'income') {
    data.income.unshift(transaction); // Add to start for "recent" first
  } else {
    data.expenses.unshift(transaction);
  }
  
  await AsyncStorage.setItem(key, JSON.stringify(data));
};

export const getSummaries = (data: MonthData) => {
  const totalIncome = data.income.reduce((sum, t) => sum + t.amount, 0);
  const totalExpenses = data.expenses.reduce((sum, t) => sum + t.amount, 0);
  return {
    totalIncome,
    totalExpenses,
    balance: totalIncome - totalExpenses,
  };
};

export const getCategoryBreakdown = (expenses: Transaction[]) => {
  const categories: Category[] = ['Food', 'Petrol', 'Repair', 'Shopping', 'Course', 'Education', 'Other'];
  const breakdown = categories.map(cat => {
    const amount = expenses
      .filter(t => t.category === cat)
      .reduce((sum, t) => sum + t.amount, 0);
    return { category: cat, amount };
  });
  
  const total = breakdown.reduce((sum, b) => sum + b.amount, 0);
  
  return breakdown
    .filter(b => b.amount > 0)
    .map(b => ({
      ...b,
      percentage: total > 0 ? (b.amount / total) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);
};
