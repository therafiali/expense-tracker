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

export const DEFAULT_CATEGORIES = [
  { id: 'Petrol', label: 'Petrol', icon: 'Fuel', color: '#3B82F6' },
  { id: 'Food', label: 'Food', icon: 'Utensils', color: '#F59E0B' },
  { id: 'Repair', label: 'Repair', icon: 'Wrench', color: '#6366F1' },
  { id: 'Shopping', label: 'Shopping', icon: 'ShoppingBag', color: '#EC4899' },
  { id: 'Course', label: 'Course', icon: 'BookOpen', color: '#8B5CF6' },
  { id: 'Education', label: 'Education', icon: 'GraduationCap', color: '#10B981' },
  { id: 'Other', label: 'Other', icon: 'CircleEllipsis', color: '#6B7280' },
];

export const getCategories = async () => {
  try {
    const data = await AsyncStorage.getItem('custom_categories');
    const custom = data ? JSON.parse(data) : [];
    return [...DEFAULT_CATEGORIES, ...custom];
  } catch (error) {
    console.error('Error fetching categories:', error);
    return DEFAULT_CATEGORIES;
  }
};

export const addCategory = async (label: string) => {
  try {
    const data = await AsyncStorage.getItem('custom_categories');
    const custom = data ? JSON.parse(data) : [];
    
    // Check if already exists
    if (custom.find((c: any) => c.label.toLowerCase() === label.toLowerCase())) return;
    if (DEFAULT_CATEGORIES.find((c: any) => c.label.toLowerCase() === label.toLowerCase())) return;

    const newCat = {
      id: label,
      label,
      icon: 'Tag', // Default icon for custom categories
      color: '#8B5CF6', // Default color
    };
    
    await AsyncStorage.setItem('custom_categories', JSON.stringify([...custom, newCat]));
    return newCat;
  } catch (error) {
    console.error('Error adding category:', error);
  }
};

export interface NoteSuggestion {
  note: string;
  amount: number;
  category?: string;
}

export const getRecentNotes = async (): Promise<NoteSuggestion[]> => {
  try {
    const data = await AsyncStorage.getItem('recent_notes_v2');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error fetching recent notes:', error);
    return [];
  }
};

export const saveRecentNote = async (note: string, amount: number, category?: string) => {
  if (!note || note.trim().length < 2) return;
  try {
    const trimmedNote = note.trim();
    const suggestions = await getRecentNotes();
    
    // Remove if already exists and add to front (most recent)
    const normalizedCategory = category?.trim();
    const filtered = suggestions.filter(
      (s) =>
        !(
          s.note.toLowerCase() === trimmedNote.toLowerCase() &&
          (s.category || '') === (normalizedCategory || '')
        )
    );
    const updated: NoteSuggestion[] = [
      { note: trimmedNote, amount, category: normalizedCategory },
      ...filtered,
    ].slice(0, 50);
    
    await AsyncStorage.setItem('recent_notes_v2', JSON.stringify(updated));
  } catch (error) {
    console.error('Error saving recent note:', error);
  }
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
  
  // Save note to suggestions
  if (transaction.note) {
    saveRecentNote(transaction.note, transaction.amount, transaction.category).catch(err => console.error('Failed to save recent note:', err));
  }
  
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
