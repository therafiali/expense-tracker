import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
} from 'date-fns';
import type { Transaction, MonthData } from './types';
import { getMonthData, resolvePaidWith } from './storage';

/** Display-only cleanup for known typos / overlaps. */
export const CATEGORY_ALIASES: Record<string, string> = {
  Dept: 'Debt',
};

export const FOOD_SNACKING_CATEGORIES = ['Food', 'Craving'] as const;
export const VEHICLE_CATEGORIES = ['Petrol', 'Repair'] as const;

export type TypeFilter = 'all' | 'income' | 'expense';
export type NoteFilter = 'all' | 'hasNote' | 'missingNote';
export type DatePreset = 'thisMonth' | 'lastMonth' | 'custom';

export interface AnalyticsFilters {
  categories: string[];
  type: TypeFilter;
  amountMin?: number;
  amountMax?: number;
  search: string;
  noteFilter: NoteFilter;
}

export function normalizeCategory(category?: string): string {
  if (!category?.trim()) return 'Uncategorized';
  return CATEGORY_ALIASES[category.trim()] ?? category.trim();
}

export function getDateRangeForPreset(preset: DatePreset, customFrom?: Date | null, customTo?: Date | null): {
  from: Date;
  to: Date;
} {
  const now = new Date();
  if (preset === 'thisMonth') {
    return { from: startOfMonth(now), to: endOfMonth(now) };
  }
  if (preset === 'lastMonth') {
    const last = subMonths(now, 1);
    return { from: startOfMonth(last), to: endOfMonth(last) };
  }
  const from = customFrom ?? startOfMonth(now);
  const to = customTo ?? endOfMonth(now);
  return from <= to ? { from, to } : { from: to, to: from };
}

export async function getTransactionsInRange(from: Date, to: Date): Promise<MonthData> {
  const rangeStart = from <= to ? from : to;
  const rangeEnd = from <= to ? to : from;
  const fromKey = format(rangeStart, 'yyyy-MM-dd');
  const toKey = format(rangeEnd, 'yyyy-MM-dd');

  const months: Date[] = [];
  let cursor = startOfMonth(rangeStart);
  const last = startOfMonth(rangeEnd);
  while (cursor.getTime() <= last.getTime()) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  const all = await Promise.all(months.map((m) => getMonthData(m)));
  const inRange = (t: Transaction) => {
    const key = format(parseISO(t.date), 'yyyy-MM-dd');
    return key >= fromKey && key <= toKey;
  };

  return {
    income: all.flatMap((m) => m.income).filter(inRange),
    expenses: all.flatMap((m) => m.expenses).filter(inRange),
  };
}

export async function getTransactionsForMonths(monthStarts: Date[]): Promise<MonthData> {
  const all = await Promise.all(monthStarts.map((m) => getMonthData(m)));
  return {
    income: all.flatMap((m) => m.income),
    expenses: all.flatMap((m) => m.expenses),
  };
}

export function toTypedTransactions(data: MonthData): Transaction[] {
  return [
    ...data.income.map((t) => ({ ...t, type: 'income' as const })),
    ...data.expenses.map((t) => ({ ...t, type: 'expense' as const })),
  ];
}

export function applyAnalyticsFilters(
  transactions: Transaction[],
  filters: AnalyticsFilters,
): Transaction[] {
  const q = filters.search.trim().toLowerCase();

  return transactions.filter((t) => {
    if (filters.type !== 'all' && t.type !== filters.type) return false;

    if (filters.categories.length > 0) {
      if (t.type === 'income') return false;
      const cat = normalizeCategory(t.category);
      const selected = filters.categories.map(normalizeCategory);
      if (!selected.includes(cat)) return false;
    }

    if (filters.amountMin != null && t.amount < filters.amountMin) return false;
    if (filters.amountMax != null && t.amount > filters.amountMax) return false;

    const hasNote = !!t.note?.trim();
    if (filters.noteFilter === 'hasNote' && !hasNote) return false;
    if (filters.noteFilter === 'missingNote' && hasNote) return false;

    if (q) {
      const hay = [
        t.note,
        t.category,
        normalizeCategory(t.category),
        t.type,
        t.amount.toString(),
        t.amount.toFixed(2),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }

    return true;
  });
}

export function collectCategories(transactions: Transaction[]): string[] {
  const set = new Set<string>();
  for (const t of transactions) {
    if (t.type === 'expense') set.add(normalizeCategory(t.category));
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function inferIncomeSource(note?: string): string {
  const n = (note ?? '').trim().toLowerCase();
  if (!n) return 'Untagged';
  if (n.includes('salary')) return 'Salary';
  if (n.includes('uzma')) return 'Personal transfer';
  if (n.includes('transfer') || n.includes('raqami') || n.includes('online transfer')) return 'Transfer';
  if (n.includes('cash')) return 'Cash';
  if (n.includes('online')) return 'Online';
  return 'Other';
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
  count: number;
}

export function getDynamicCategoryBreakdown(expenses: Transaction[]): CategoryBreakdownItem[] {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const tx of expenses) {
    const cat = normalizeCategory(tx.category);
    const prev = totals.get(cat) ?? { amount: 0, count: 0 };
    totals.set(cat, { amount: prev.amount + tx.amount, count: prev.count + 1 });
  }

  const rows = [...totals.entries()]
    .map(([category, stats]) => ({ category, ...stats }))
    .sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return rows.map((r) => ({
    ...r,
    percentage: total > 0 ? (r.amount / total) * 100 : 0,
  }));
}

export function sumByCategories(expenses: Transaction[], categories: readonly string[]): number {
  const normalized = new Set(categories.map((c) => normalizeCategory(c)));
  return expenses
    .filter((t) => normalized.has(normalizeCategory(t.category)))
    .reduce((sum, t) => sum + t.amount, 0);
}

export interface IncomeSourceItem {
  source: string;
  amount: number;
  percentage: number;
  count: number;
}

export function getIncomeSourceBreakdown(income: Transaction[]): IncomeSourceItem[] {
  const totals = new Map<string, { amount: number; count: number }>();

  for (const tx of income) {
    const source = inferIncomeSource(tx.note);
    const prev = totals.get(source) ?? { amount: 0, count: 0 };
    totals.set(source, { amount: prev.amount + tx.amount, count: prev.count + 1 });
  }

  const rows = [...totals.entries()]
    .map(([source, stats]) => ({ source, ...stats }))
    .sort((a, b) => b.amount - a.amount);

  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  return rows.map((r) => ({
    ...r,
    percentage: total > 0 ? (r.amount / total) * 100 : 0,
  }));
}

export interface MonthlyTrendPoint {
  monthKey: string;
  label: string;
  income: number;
  expense: number;
  balance: number;
}

export function computeMonthlyTrend(transactions: Transaction[], monthStarts: Date[]): MonthlyTrendPoint[] {
  return monthStarts.map((monthStart) => {
    const monthKey = format(monthStart, 'yyyy-MM');
    const monthEnd = endOfMonth(monthStart);
    let income = 0;
    let expense = 0;
    let cashExpense = 0;

    for (const t of transactions) {
      const d = parseISO(t.date);
      if (d < monthStart || d > monthEnd) continue;
      if (t.type === 'income') income += t.amount;
      else {
        expense += t.amount;
        if (resolvePaidWith(t) !== 'online') cashExpense += t.amount;
      }
    }

    return {
      monthKey,
      label: format(monthStart, 'MMM yy'),
      income,
      expense,
      balance: income - cashExpense,
    };
  });
}

export interface CategoryMonthShare {
  monthKey: string;
  label: string;
  totalExpense: number;
  segments: { category: string; amount: number; percentage: number; colorKey: string }[];
}

const TREND_CATEGORY_COLORS = [
  '#F59E0B',
  '#3B82F6',
  '#6366F1',
  '#EC4899',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
  '#6B7280',
];

export function computeCategoryShareOverTime(
  transactions: Transaction[],
  monthStarts: Date[],
  topN = 5,
): CategoryMonthShare[] {
  return monthStarts.map((monthStart) => {
    const monthKey = format(monthStart, 'yyyy-MM');
    const monthEnd = endOfMonth(monthStart);
    const totals = new Map<string, number>();

    for (const t of transactions) {
      if (t.type !== 'expense') continue;
      const d = parseISO(t.date);
      if (d < monthStart || d > monthEnd) continue;
      const cat = normalizeCategory(t.category);
      totals.set(cat, (totals.get(cat) ?? 0) + t.amount);
    }

    const sorted = [...totals.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount);

    const totalExpense = sorted.reduce((sum, r) => sum + r.amount, 0);
    const top = sorted.slice(0, topN);
    const otherAmount = sorted.slice(topN).reduce((sum, r) => sum + r.amount, 0);

    const segments = top.map((row, i) => ({
      category: row.category,
      amount: row.amount,
      percentage: totalExpense > 0 ? (row.amount / totalExpense) * 100 : 0,
      colorKey: TREND_CATEGORY_COLORS[i % TREND_CATEGORY_COLORS.length],
    }));

    if (otherAmount > 0) {
      segments.push({
        category: 'Other',
        amount: otherAmount,
        percentage: totalExpense > 0 ? (otherAmount / totalExpense) * 100 : 0,
        colorKey: TREND_CATEGORY_COLORS[TREND_CATEGORY_COLORS.length - 1],
      });
    }

    return {
      monthKey,
      label: format(monthStart, 'MMM yy'),
      totalExpense,
      segments,
    };
  });
}

export function countMissingDetails(transactions: Transaction[]): {
  missingNote: number;
  uncategorizedExpense: number;
} {
  let missingNote = 0;
  let uncategorizedExpense = 0;

  for (const t of transactions) {
    if (!t.note?.trim()) missingNote += 1;
    if (t.type === 'expense' && !t.category?.trim()) uncategorizedExpense += 1;
  }

  return { missingNote, uncategorizedExpense };
}

export function getTrendMonthStarts(endDate: Date, count = 6): Date[] {
  const end = startOfMonth(endDate);
  return Array.from({ length: count }, (_, i) => subMonths(end, count - 1 - i));
}

export { TREND_CATEGORY_COLORS };
