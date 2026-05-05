import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfDay, endOfMonth, endOfWeek } from 'date-fns';
import { Goal, GoalPeriod, GoalReminderSlot, GoalProgressEntry } from './types';
import { pushGoal, pushGoalProgress, syncGoalsLocalToCloud } from './sync';

const GOALS_STORAGE_KEY = 'goals_v1';
const GOAL_PROGRESS_STORAGE_KEY = 'goal_progress_v1';

function triggerGoalSync(reason: string) {
  syncGoalsLocalToCloud().catch((err) => console.error(`[goal-sync] ${reason} failed:`, err));
}

function generateGoalId(): string {
  return 'goal-xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getPeriodEnd(date: Date, period: GoalPeriod): Date {
  if (period === 'daily') return endOfDay(date);
  if (period === 'weekly') return endOfWeek(date, { weekStartsOn: 1 });
  return endOfMonth(date);
}

function hasPeriodRolled(anchorIso: string, period: GoalPeriod, now: Date): boolean {
  const anchor = new Date(anchorIso);
  return now.getTime() > getPeriodEnd(anchor, period).getTime();
}

export async function getGoals(): Promise<Goal[]> {
  try {
    const raw = await AsyncStorage.getItem(GOALS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error fetching goals:', error);
    return [];
  }
}

export async function saveGoals(goals: Goal[]): Promise<void> {
  await AsyncStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

function progressId(goalId: string, dateKey: string): string {
  return `${goalId}:${dateKey}`;
}

function getDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function getGoalProgress(): Promise<GoalProgressEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(GOAL_PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Error fetching goal progress:', error);
    return [];
  }
}

async function saveGoalProgress(entries: GoalProgressEntry[]): Promise<void> {
  await AsyncStorage.setItem(GOAL_PROGRESS_STORAGE_KEY, JSON.stringify(entries));
}

export async function syncGoalPeriods(): Promise<Goal[]> {
  const now = new Date();
  const goals = (await getGoals()).filter((goal) => goal.isActive);
  let changed = false;

  const updated = goals.map((goal) => {
    if (!hasPeriodRolled(goal.periodAnchor, goal.period, now)) {
      return goal;
    }

    changed = true;
    return {
      ...goal,
      completedCount: 0,
      periodAnchor: now.toISOString(),
      updatedAt: now.toISOString(),
    };
  });

  if (changed) {
    await saveGoals(updated);
  }

  return updated;
}

export interface UpsertGoalInput {
  id?: string;
  title: string;
  emoji?: string;
  targetCount: number;
  period: GoalPeriod;
  remindersPerPeriod: number;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderSlots?: GoalReminderSlot[];
  isActive?: boolean;
}

export async function upsertGoal(input: UpsertGoalInput): Promise<Goal> {
  const nowIso = new Date().toISOString();
  const goals = await getGoals();

  if (input.id) {
    const idx = goals.findIndex((goal) => goal.id === input.id);
    if (idx >= 0) {
      const existing = goals[idx];
      const next: Goal = {
        ...existing,
        ...input,
        title: input.title.trim(),
        targetCount: Math.max(1, Math.floor(input.targetCount)),
        remindersPerPeriod: Math.max(1, Math.floor(input.remindersPerPeriod)),
        reminderSlots: input.reminderSlots?.filter((slot) => slot.time.trim().length > 0) ?? [],
        updatedAt: nowIso,
        isActive: input.isActive ?? true,
      };
      goals[idx] = next;
      await saveGoals(goals);
      pushGoal(next).catch((err) => console.error('Goal sync failed:', err));
      triggerGoalSync('upsert existing goal');
      return next;
    }
  }

  const goal: Goal = {
    id: generateGoalId(),
    title: input.title.trim(),
    emoji: input.emoji?.trim() || undefined,
    targetCount: Math.max(1, Math.floor(input.targetCount)),
    completedCount: 0,
    period: input.period,
    reminderEnabled: input.reminderEnabled,
    remindersPerPeriod: Math.max(1, Math.floor(input.remindersPerPeriod)),
    reminderTime: input.reminderTime,
    reminderSlots: input.reminderSlots?.filter((slot) => slot.time.trim().length > 0) ?? [],
    periodAnchor: nowIso,
    createdAt: nowIso,
    updatedAt: nowIso,
    isActive: input.isActive ?? true,
  };

  await saveGoals([goal, ...goals]);
  pushGoal(goal).catch((err) => console.error('Goal sync failed:', err));
  triggerGoalSync('create goal');
  return goal;
}

export async function adjustGoalProgress(goalId: string, delta: number): Promise<Goal | null> {
  const nowIso = new Date().toISOString();
  const today = getDateKey();
  const goals = await syncGoalPeriods();
  const idx = goals.findIndex((goal) => goal.id === goalId);
  if (idx < 0) return null;

  const goal = goals[idx];
  const nextCompleted = Math.max(0, Math.min(goal.targetCount, goal.completedCount + delta));
  const updated: Goal = {
    ...goal,
    completedCount: nextCompleted,
    updatedAt: nowIso,
  };
  goals[idx] = updated;
  await saveGoals(goals);
  pushGoal(updated).catch((err) => console.error('Goal sync failed:', err));

  if (delta !== 0) {
    const progressEntries = await getGoalProgress();
    const id = progressId(goalId, today);
    const entryIdx = progressEntries.findIndex((entry) => entry.id === id);
    if (entryIdx >= 0) {
      const nextCount = Math.max(0, progressEntries[entryIdx].count + delta);
      progressEntries[entryIdx] = {
        ...progressEntries[entryIdx],
        count: nextCount,
        updatedAt: nowIso,
      };
    } else {
      progressEntries.push({
        id,
        goalId,
        dateKey: today,
        count: Math.max(0, delta),
        updatedAt: nowIso,
      });
    }
    await saveGoalProgress(progressEntries);
    const syncedEntry = progressEntries.find((entry) => entry.id === id);
    if (syncedEntry) {
      pushGoalProgress(syncedEntry).catch((err) => console.error('Goal progress sync failed:', err));
    }
  }

  triggerGoalSync('adjust goal progress');

  return updated;
}

export async function archiveGoal(goalId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const goals = await getGoals();
  const updated = goals.map((goal) =>
    goal.id === goalId ? { ...goal, isActive: false, updatedAt: nowIso } : goal,
  );
  await saveGoals(updated);
  const archived = updated.find((goal) => goal.id === goalId);
  if (archived) {
    pushGoal(archived).catch((err) => console.error('Goal archive sync failed:', err));
  }
  triggerGoalSync('archive goal');
}

export async function getGoalById(goalId: string): Promise<Goal | null> {
  const goals = (await getGoals()).filter((goal) => goal.isActive);
  return goals.find((goal) => goal.id === goalId) ?? null;
}

export async function getActiveGoals(): Promise<Goal[]> {
  const goals = await getGoals();
  return goals.filter((goal) => goal.isActive);
}

export async function replaceGoalDataFromCloud(goals: Goal[]): Promise<void> {
  await saveGoals(goals);
}

export async function replaceGoalProgressFromCloud(entries: GoalProgressEntry[]): Promise<void> {
  await saveGoalProgress(entries);
}

export async function getGoalProgressSummary(goalId: string): Promise<{
  totalDone: number;
  thisMonthDone: number;
}> {
  const entries = await getGoalProgress();
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-`;
  const scoped = entries.filter((entry) => entry.goalId === goalId);
  return {
    totalDone: scoped.reduce((sum, entry) => sum + entry.count, 0),
    thisMonthDone: scoped
      .filter((entry) => entry.dateKey.startsWith(monthPrefix))
      .reduce((sum, entry) => sum + entry.count, 0),
  };
}
