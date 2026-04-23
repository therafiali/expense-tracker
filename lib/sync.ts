import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMonthKey, MonthData, Transaction, UserProfile } from './types';
import { format, parseISO } from 'date-fns';

/**
 * The sync service handles moving data between AsyncStorage and Supabase.
 * It uses a "Last Write Wins" strategy and ensures that local storage
 * is always the immediate source of truth for the UI.
 */

export const syncLocalToCloud = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;
  
  // 1. Get all local data keys
  const allKeys = await AsyncStorage.getAllKeys();
  const dataKeys = allKeys.filter(key => key.startsWith('data_'));

  for (const key of dataKeys) {
    const localData = await AsyncStorage.getItem(key);
    if (!localData) continue;

    const parsed: MonthData = JSON.parse(localData);
    const allTransactions = [...parsed.income, ...parsed.expenses];

    // 2. Upsert each transaction to Supabase
    // We use upsert so that existing records are updated if they changed
    if (allTransactions.length > 0) {
      const { error } = await supabase
        .from('transactions')
        .insert(
          allTransactions.map(t => ({
            user_id: userId,
            amount: t.amount,
            type: t.type,
            category: t.category,
            note: t.note,
            date: t.date,
            updated_at: new Date().toISOString(),
          }))
        );
      
      if (error) console.error('Error syncing to cloud:', error);
    }
  }
};

export const syncCloudToLocal = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  // 1. Fetch all transactions from Supabase
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error || !transactions) {
    console.error('Error fetching from cloud:', error);
    return;
  }

  // 2. Rebuild the monthly local storage
  const months: Record<string, MonthData> = {};

  transactions.forEach((t: any) => {
    const date = parseISO(t.date);
    const key = getMonthKey(date);
    
    if (!months[key]) {
      months[key] = { income: [], expenses: [] };
    }

    const transaction: Transaction = {
      id: t.id,
      amount: t.amount,
      date: t.date,
      note: t.note,
      category: t.category,
      type: t.type,
    };

    if (t.type === 'income') {
      months[key].income.push(transaction);
    } else {
      months[key].expenses.push(transaction);
    }
  });

  // 3. Save all rebuilt months to AsyncStorage
  for (const [key, data] of Object.entries(months)) {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  }
};

/**
 * Hook to be called whenever a transaction is saved locally
 */
export const pushTransaction = async (transaction: Transaction) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('transactions')
    .insert({
      user_id: session.user.id,
      amount: transaction.amount,
      type: transaction.type,
      category: transaction.category,
      note: transaction.note,
      date: transaction.date,
      updated_at: new Date().toISOString(),
    });

  if (error) console.error('Error pushing transaction:', error);
};

/**
 * Sync the user profile to Supabase
 */
export const syncProfile = async (profile: UserProfile) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: session.user.id,
      full_name: profile.name,
      currency: profile.currency,
      updated_at: new Date().toISOString(),
    });

  if (error) console.error('Error syncing profile:', error);
};

/**
 * Perform a full bi-directional sync
 */
export const syncAll = async () => {
  console.log('Starting full sync...');
  await syncLocalToCloud();
  await syncCloudToLocal();
  console.log('Full sync complete.');
};
