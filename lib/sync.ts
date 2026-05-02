import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMonthKey, MonthData, Transaction, UserProfile } from './types';
import { parseISO } from 'date-fns';

/**
 * Sync between AsyncStorage and Supabase.
 *
 * - Local writes stay authoritative until successfully upserted.
 * - pushTransaction / syncLocalToCloud use upsert on `id` (safe retries, edits).
 * - syncCloudToLocal merges server rows into each month: same id → server wins.
 *   Rows deleted only on the server are not removed locally (no tombstones).
 */

const UPSERT_CHUNK_SIZE = 80;

/** Merge cloud month into local: keyed txs use cloud copy when present; id-less local txs kept. */
function mergeMonthData(local: MonthData, cloud: MonthData): MonthData {
  const map = new Map<string, Transaction>();
  const noId: Transaction[] = [];

  for (const t of [...local.income, ...local.expenses]) {
    if (t.id) map.set(t.id, t);
    else noId.push(t);
  }

  for (const t of [...cloud.income, ...cloud.expenses]) {
    if (t.id) map.set(t.id, { ...t });
  }

  const income = [...noId.filter((t) => t.type === 'income')];
  const expenses = [...noId.filter((t) => t.type === 'expense')];

  for (const t of map.values()) {
    if (t.type === 'income') income.push(t);
    else expenses.push(t);
  }

  const byDateDesc = (a: Transaction, b: Transaction) =>
    new Date(b.date).getTime() - new Date(a.date).getTime();
  income.sort(byDateDesc);
  expenses.sort(byDateDesc);

  return { income, expenses };
}

function rowFromTransaction(userId: string, t: Transaction & { id: string }) {
  return {
    id: t.id,
    user_id: userId,
    amount: t.amount,
    type: t.type,
    category: t.category,
    note: t.note,
    date: t.date,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Push all local month files to Supabase (upsert by transaction id).
 */
export const syncLocalToCloud = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;
  const allKeys = await AsyncStorage.getAllKeys();
  const dataKeys = allKeys.filter((key) => key.startsWith('data_'));

  for (const key of dataKeys) {
    const localData = await AsyncStorage.getItem(key);
    if (!localData) continue;

    const parsed: MonthData = JSON.parse(localData);
    const allTransactions = [...parsed.income, ...parsed.expenses];
    const rows = allTransactions
      .filter((t): t is Transaction & { id: string } => Boolean(t.id))
      .map((t) => rowFromTransaction(userId, t));

    for (let i = 0; i < rows.length; i += UPSERT_CHUNK_SIZE) {
      const chunk = rows.slice(i, i + UPSERT_CHUNK_SIZE);
      if (chunk.length === 0) continue;

      const { error } = await supabase.from('transactions').upsert(chunk, { onConflict: 'id' });

      if (error) console.error('Error syncing to cloud:', error);
    }
  }
};

/**
 * Fetch remote transactions and merge into local month buckets (does not delete unknown keys).
 */
export const syncCloudToLocal = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false });

  if (error || !transactions) {
    console.error('Error fetching from cloud:', error);
    return;
  }

  const cloudMonths: Record<string, MonthData> = {};

  transactions.forEach((t: Record<string, unknown>) => {
    const date = parseISO(String(t.date));
    const key = getMonthKey(date);

    if (!cloudMonths[key]) {
      cloudMonths[key] = { income: [], expenses: [] };
    }

    const transaction: Transaction = {
      id: String(t.id),
      amount: typeof t.amount === 'number' ? t.amount : Number(t.amount),
      date: String(t.date),
      note: t.note != null ? String(t.note) : undefined,
      category: t.category != null ? String(t.category) : undefined,
      type: t.type as Transaction['type'],
    };

    if (transaction.type === 'income') {
      cloudMonths[key].income.push(transaction);
    } else {
      cloudMonths[key].expenses.push(transaction);
    }
  });

  for (const [key, cloudData] of Object.entries(cloudMonths)) {
    const raw = await AsyncStorage.getItem(key);
    const local: MonthData = raw ? JSON.parse(raw) : { income: [], expenses: [] };
    const merged = mergeMonthData(local, cloudData);
    await AsyncStorage.setItem(key, JSON.stringify(merged));
  }
};

/** Single-transaction upsert (insert or replace by id). */
export const pushTransaction = async (transaction: Transaction) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session || !transaction.id) return;

  const row = rowFromTransaction(session.user.id, transaction as Transaction & { id: string });

  const { error } = await supabase.from('transactions').upsert(row, { onConflict: 'id' });

  if (error) console.error('Error pushing transaction:', error);
};

/** Edits use the same upsert path so a missed insert still creates the row. */
export const patchTransaction = pushTransaction;

export const deleteTransactionRemote = async (id: string) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', session.user.id);

  if (error) console.error('Error deleting transaction:', error);
};

export const syncProfile = async (profile: UserProfile) => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { error } = await supabase.from('profiles').upsert({
    id: session.user.id,
    full_name: profile.name,
    currency: profile.currency,
    updated_at: new Date().toISOString(),
  });

  if (error) console.error('Error syncing profile:', error);
};

/**
 * Push local changes, then pull remote and merge into AsyncStorage.
 */
export const syncAll = async () => {
  await syncLocalToCloud();
  await syncCloudToLocal();
};
