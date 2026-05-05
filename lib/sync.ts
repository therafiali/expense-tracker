import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { getMonthKey, Goal, GoalProgressEntry, MonthData, Transaction, UserProfile } from './types';
import { parseISO } from 'date-fns';
import { DeviceEventEmitter } from 'react-native';

/** Fired after cloud data is merged into AsyncStorage so list screens can reload. */
export const TRANSACTIONS_SYNCED_EVENT = 'aco_transactions_synced';

function emitTransactionsSynced() {
  DeviceEventEmitter.emit(TRANSACTIONS_SYNCED_EVENT);
}

async function getSessionWithBriefRetry(): Promise<Session | null> {
  const first = await supabase.auth.getSession();
  if (first.data.session) return first.data.session;
  await new Promise((r) => setTimeout(r, 450));
  const second = await supabase.auth.getSession();
  return second.data.session;
}

/**
 * Sync between AsyncStorage and Supabase.
 *
 * - Local writes stay authoritative until successfully upserted.
 * - pushTransaction / syncLocalToCloud use upsert on `id` (safe retries, edits).
 * - syncCloudToLocal merges server rows into each month: same id → server wins.
 *   Rows deleted only on the server are not removed locally (no tombstones).
 */

const UPSERT_CHUNK_SIZE = 80;
const GOALS_STORAGE_KEY = 'goals_v1';
const GOAL_PROGRESS_STORAGE_KEY = 'goal_progress_v1';

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

function rowFromGoal(userId: string, goal: Goal) {
  return {
    id: goal.id,
    user_id: userId,
    title: goal.title,
    emoji: goal.emoji ?? null,
    target_count: goal.targetCount,
    completed_count: goal.completedCount,
    period: goal.period,
    reminder_enabled: goal.reminderEnabled,
    reminders_per_period: goal.remindersPerPeriod,
    reminder_time: goal.reminderTime,
    reminder_slots: goal.reminderSlots ?? [],
    period_anchor: goal.periodAnchor,
    is_active: goal.isActive,
    created_at: goal.createdAt,
    updated_at: goal.updatedAt,
  };
}

function rowFromGoalProgress(userId: string, progress: GoalProgressEntry) {
  return {
    id: progress.id,
    user_id: userId,
    goal_id: progress.goalId,
    date_key: progress.dateKey,
    count: progress.count,
    updated_at: progress.updatedAt,
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

export const syncGoalsLocalToCloud = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const rawGoals = await AsyncStorage.getItem(GOALS_STORAGE_KEY);
  const goals: Goal[] = rawGoals ? JSON.parse(rawGoals) : [];
  const goalRows = goals.map((goal) => rowFromGoal(session.user.id, goal));
  for (let i = 0; i < goalRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = goalRows.slice(i, i + UPSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabase.from('goals').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error syncing goals to cloud:', error);
  }

  const rawProgress = await AsyncStorage.getItem(GOAL_PROGRESS_STORAGE_KEY);
  const entries: GoalProgressEntry[] = rawProgress ? JSON.parse(rawProgress) : [];
  const progressRows = entries.map((entry) => rowFromGoalProgress(session.user.id, entry));
  for (let i = 0; i < progressRows.length; i += UPSERT_CHUNK_SIZE) {
    const chunk = progressRows.slice(i, i + UPSERT_CHUNK_SIZE);
    if (chunk.length === 0) continue;
    const { error } = await supabase.from('goal_progress').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error syncing goal progress to cloud:', error);
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

  emitTransactionsSynced();
};

export const syncGoalsCloudToLocal = async () => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return;

  const { data: goals, error: goalsError } = await supabase
    .from('goals')
    .select('*')
    .order('updated_at', { ascending: false });
  if (goalsError) {
    console.error('Error fetching goals from cloud:', goalsError);
    return;
  }
  if (goals) {
    const mapped: Goal[] = goals.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      title: String(row.title ?? ''),
      emoji: row.emoji != null ? String(row.emoji) : undefined,
      targetCount: Number(row.target_count ?? 1),
      completedCount: Number(row.completed_count ?? 0),
      period: (row.period as Goal['period']) ?? 'daily',
      reminderEnabled: Boolean(row.reminder_enabled),
      remindersPerPeriod: Number(row.reminders_per_period ?? 1),
      reminderTime: String(row.reminder_time ?? '09:00'),
      reminderSlots: Array.isArray(row.reminder_slots)
        ? (row.reminder_slots as Goal['reminderSlots'])
        : [],
      periodAnchor: String(row.period_anchor ?? new Date().toISOString()),
      createdAt: String(row.created_at ?? new Date().toISOString()),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
      isActive: Boolean(row.is_active),
    }));
    await AsyncStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(mapped));
  }

  const { data: progressRows, error: progressError } = await supabase
    .from('goal_progress')
    .select('*')
    .order('updated_at', { ascending: false });
  if (progressError) {
    console.error('Error fetching goal progress from cloud:', progressError);
    return;
  }
  if (progressRows) {
    const mappedProgress: GoalProgressEntry[] = progressRows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      goalId: String(row.goal_id),
      dateKey: String(row.date_key),
      count: Number(row.count ?? 0),
      updatedAt: String(row.updated_at ?? new Date().toISOString()),
    }));
    await AsyncStorage.setItem(GOAL_PROGRESS_STORAGE_KEY, JSON.stringify(mappedProgress));
  }
};

/** Single-transaction upsert (insert or replace by id). */
export const pushTransaction = async (transaction: Transaction) => {
  if (!transaction.id) return;

  const session = await getSessionWithBriefRetry();
  if (!session) return;

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

export const pushGoal = async (goal: Goal) => {
  const session = await getSessionWithBriefRetry();
  if (!session) return;
  const row = rowFromGoal(session.user.id, goal);
  const { error } = await supabase.from('goals').upsert(row, { onConflict: 'id' });
  if (error) console.error('Error pushing goal:', error);
};

export const pushGoalProgress = async (entry: GoalProgressEntry) => {
  const session = await getSessionWithBriefRetry();
  if (!session) return;
  const row = rowFromGoalProgress(session.user.id, entry);
  const { error } = await supabase.from('goal_progress').upsert(row, { onConflict: 'id' });
  if (error) console.error('Error pushing goal progress:', error);
};

/**
 * Push local changes, then pull remote and merge into AsyncStorage.
 */
export const syncAll = async () => {
  await syncLocalToCloud();
  await syncGoalsLocalToCloud();
  await syncCloudToLocal();
  await syncGoalsCloudToLocal();
};
