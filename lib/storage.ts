import AsyncStorage from '@react-native-async-storage/async-storage';
import { pushTransaction, syncProfile } from './sync';
import { Category, Transaction, UserProfile, MonthData, getMonthKey, CURRENCY_SYMBOLS } from './types';

export { Category, Transaction, UserProfile, MonthData, getMonthKey };

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
    data.income.unshift(transaction); 
  } else {
    data.expenses.unshift(transaction);
  }
  
  // Save locally first for instant UI feedback
  await AsyncStorage.setItem(key, JSON.stringify(data));
  
  // Push to cloud in the background
  pushTransaction(transaction).catch(err => console.error('Background sync failed:', err));
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

export const getUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const data = await AsyncStorage.getItem('user_profile');
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error fetching profile:', error);
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile) => {
  try {
    await AsyncStorage.setItem('user_profile', JSON.stringify(profile));
    // Push to cloud in the background
    syncProfile(profile).catch(err => console.error('Profile sync failed:', err));
  } catch (error) {
    console.error('Error saving profile:', error);
  }
};

export const getCurrency = async (): Promise<string> => {
  const profile = await getUserProfile();
  return profile?.currency || 'USD';
};

export const getCurrencySymbol = async (): Promise<string> => {
  const code = await getCurrency();
  return CURRENCY_SYMBOLS[code] || '$';
};
