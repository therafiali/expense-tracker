import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, format } from 'date-fns';
import { DeviceEventEmitter } from 'react-native';
import { formatReminderTime, parseReminderTime } from './reminders';
import { saveTransaction } from './storage';
import type { ExpensePrompt } from './types';

const STORAGE_KEY = 'expense_prompts_v1';

export const EXPENSE_PROMPTS_CHANGED_EVENT = 'expense_prompts_changed';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function expensePromptTodayKey(now = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

export function expensePromptDueDate(prompt: ExpensePrompt, now = new Date()): Date {
  const { hour, minute } = parseReminderTime(prompt.time);
  const due = new Date(now);
  due.setHours(hour, minute, 0, 0);
  return due;
}

export function isExpensePromptDue(prompt: ExpensePrompt, now = new Date()): boolean {
  if (!prompt.enabled || !prompt.isActive) return false;
  if (prompt.lastHandledOn === expensePromptTodayKey(now)) return false;
  return now.getTime() >= expensePromptDueDate(prompt, now).getTime();
}

export function getDueExpensePrompts(prompts: ExpensePrompt[], now = new Date()): ExpensePrompt[] {
  return prompts
    .filter((prompt) => isExpensePromptDue(prompt, now))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

/** Milliseconds until the next popup should be checked. 0 means one is due now. */
export function msUntilNextExpensePrompt(
  prompts: ExpensePrompt[],
  now = new Date(),
  snoozedUntil: Map<string, number> = new Map(),
): number | null {
  const active = prompts.filter((prompt) => prompt.enabled && prompt.isActive);
  if (active.length === 0) return null;

  let best: number | null = null;
  const consider = (at: number) => {
    const wait = at - now.getTime();
    if (wait < 0) return;
    if (best == null || wait < best) best = wait;
  };

  for (const prompt of active) {
    const due = expensePromptDueDate(prompt, now);
    const snoozeAt = snoozedUntil.get(prompt.id) ?? 0;
    const handledToday = prompt.lastHandledOn === expensePromptTodayKey(now);

    if (handledToday) {
      consider(addDays(due, 1).getTime());
      continue;
    }

    if (now.getTime() >= due.getTime()) {
      if (snoozeAt > now.getTime()) consider(snoozeAt);
      else return 0;
    } else {
      consider(Math.max(due.getTime(), snoozeAt));
    }
  }

  return best;
}

export function formatExpensePromptSchedule(prompt: ExpensePrompt, now = new Date()): string {
  const timeLabel = formatReminderTime(prompt.time);
  if (!prompt.enabled) return `Paused. Every day at ${timeLabel}`;
  if (prompt.lastHandledOn === expensePromptTodayKey(now)) {
    return `Done for today. Back tomorrow at ${timeLabel}`;
  }
  return `Every day at ${timeLabel}`;
}

function emitChanged() {
  DeviceEventEmitter.emit(EXPENSE_PROMPTS_CHANGED_EVENT);
}

export async function getExpensePrompts(): Promise<ExpensePrompt[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ExpensePrompt[]) : [];
  } catch (error) {
    console.error('Error fetching expense prompts:', error);
    return [];
  }
}

async function saveAll(prompts: ExpensePrompt[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  emitChanged();
}

export async function getActiveExpensePrompts(): Promise<ExpensePrompt[]> {
  const prompts = await getExpensePrompts();
  return prompts
    .filter((prompt) => prompt.isActive)
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

export async function getExpensePromptById(id: string): Promise<ExpensePrompt | null> {
  const prompts = await getActiveExpensePrompts();
  return prompts.find((prompt) => prompt.id === id) ?? null;
}

export interface UpsertExpensePromptInput {
  id?: string;
  title: string;
  time: string;
  category?: string;
  enabled?: boolean;
}

export async function upsertExpensePrompt(input: UpsertExpensePromptInput): Promise<ExpensePrompt> {
  const nowIso = new Date().toISOString();
  const prompts = await getExpensePrompts();
  const title = input.title.trim();
  const time = input.time.trim() || '14:20';
  const category = input.category?.trim() || undefined;

  if (input.id) {
    const idx = prompts.findIndex((prompt) => prompt.id === input.id);
    if (idx >= 0) {
      const next: ExpensePrompt = {
        ...prompts[idx],
        title,
        time,
        category,
        enabled: input.enabled ?? prompts[idx].enabled,
        isActive: true,
        updatedAt: nowIso,
      };
      prompts[idx] = next;
      await saveAll(prompts);
      return next;
    }
  }

  const prompt: ExpensePrompt = {
    id: generateId(),
    title,
    time,
    category,
    enabled: input.enabled ?? true,
    isActive: true,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await saveAll([prompt, ...prompts]);
  return prompt;
}

export async function setExpensePromptEnabled(id: string, enabled: boolean): Promise<void> {
  const nowIso = new Date().toISOString();
  const prompts = await getExpensePrompts();
  const updated = prompts.map((prompt) =>
    prompt.id === id ? { ...prompt, enabled, updatedAt: nowIso } : prompt,
  );
  await saveAll(updated);
}

export async function archiveExpensePrompt(id: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const prompts = await getExpensePrompts();
  const updated = prompts.map((prompt) =>
    prompt.id === id ? { ...prompt, isActive: false, updatedAt: nowIso } : prompt,
  );
  await saveAll(updated);
}

async function markHandled(id: string, now = new Date()): Promise<void> {
  const prompts = await getExpensePrompts();
  const updated = prompts.map((prompt) =>
    prompt.id === id
      ? {
          ...prompt,
          lastHandledOn: expensePromptTodayKey(now),
          updatedAt: now.toISOString(),
        }
      : prompt,
  );
  await saveAll(updated);
}

export async function skipExpensePromptToday(id: string): Promise<void> {
  await markHandled(id);
}

export async function saveExpenseFromPrompt(
  prompt: ExpensePrompt,
  input: { note: string; amount: number },
): Promise<void> {
  const now = new Date();
  const note = input.note.trim() || prompt.title.trim();
  await saveTransaction(now, {
    amount: input.amount,
    date: now.toISOString(),
    note,
    category: prompt.category,
    type: 'expense',
    paidWith: 'cash',
  });
  await markHandled(prompt.id, now);
}
