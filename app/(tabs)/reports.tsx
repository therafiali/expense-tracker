import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subMonths, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useIsFocused } from '@react-navigation/native';

import {
  getMonthData,
  getSummaries,
  getCurrencySymbol,
  type MonthData,
  type Transaction,
} from '@/lib/storage';
import { getActiveGoals, getGoalProgress } from '@/lib/goals';
import { iconForCategory, colorForCategory } from '@/components/category-icon';

import { useTheme } from '@/lib/theme';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';

export default function ReportsScreen() {
  const scrollRef = useScrollToTopOnFocus();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [goalRows, setGoalRows] = useState<
    Array<{ id: string; title: string; emoji?: string; targetCount: number; done: number; percent: number }>
  >([]);
  const isFocused = useIsFocused();
  const { colors } = useTheme();

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, currentDate]);

  const loadData = async () => {
    setLoading(true);
    const [monthData, goals, progress] = await Promise.all([
      getMonthData(currentDate),
      getActiveGoals(),
      getGoalProgress(),
    ]);
    const monthPrefix = format(currentDate, 'yyyy-MM');
    const progressMap = new Map<string, number>();
    for (const entry of progress) {
      if (!entry.dateKey.startsWith(monthPrefix)) continue;
      progressMap.set(entry.goalId, (progressMap.get(entry.goalId) ?? 0) + entry.count);
    }
    const rows = goals
      .map((goal) => {
        const done = progressMap.get(goal.id) ?? 0;
        const target = Math.max(1, goal.targetCount);
        const percent = Math.min(100, (done / target) * 100);
        return { id: goal.id, title: goal.title, emoji: goal.emoji, targetCount: target, done, percent };
      })
      .sort((a, b) => b.percent - a.percent);
    setData(monthData);
    setGoalRows(rows);
    setLoading(false);
  };

  const { totalIncome, totalExpenses, balance } = getSummaries(data);

  const allTx: Transaction[] = [
    ...data.income.map((t) => ({ ...t, type: 'income' as const })),
    ...data.expenses.map((t) => ({ ...t, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleExportExpenses = async () => {
    setExporting(true);
    const currencySymbol = await getCurrencySymbol();
    const html = `
      <html><head><style>
        body { font-family: Helvetica, sans-serif; padding: 40px; color: #111; }
        h1 { color: #2A6174; margin-bottom: 4px; }
        .sub { color: #666; margin-bottom: 30px; }
        .summary { display:flex; gap:16px; margin-bottom:30px; }
        .card { flex:1; background:#f4f4f4; border-radius:10px; padding:16px; text-align:center; }
        .card h3 { margin:0 0 8px; font-size:12px; color:#777; }
        .card p { margin:0; font-size:22px; font-weight:bold; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; padding:10px 8px; border-bottom:2px solid #eee; color:#444; }
        td { padding:10px 8px; border-bottom:1px solid #f0f0f0; }
        .inc { color:#2A6174; font-weight:bold; }
        .exp { color:#EF4444; font-weight:bold; }
      </style></head><body>
        <h1>WalletWatch Expense Report</h1>
        <p class="sub">${format(currentDate, 'MMMM yyyy')}</p>
        <div class="summary">
          <div class="card"><h3>Income</h3><p style="color:#2A6174">${currencySymbol}${totalIncome.toFixed(2)}</p></div>
          <div class="card"><h3>Expenses</h3><p style="color:#EF4444">${currencySymbol}${totalExpenses.toFixed(2)}</p></div>
          <div class="card"><h3>Balance</h3><p>${currencySymbol}${balance.toFixed(2)}</p></div>
        </div>
        <table>
          <thead><tr><th>Date</th><th>Type / Category</th><th>Note</th><th>Amount</th></tr></thead>
          <tbody>
            ${allTx.map(t => `
              <tr>
                <td>${format(new Date(t.date), 'MMM dd')}</td>
                <td>${t.type === 'income' ? 'Income' : t.category || 'Expense'}</td>
                <td>${t.note || '-'}</td>
                <td class="${t.type === 'income' ? 'inc' : 'exp'}">${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Report' });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  const handleExportGoals = async () => {
    setExporting(true);
    const html = `
      <html><head><style>
        body { font-family: Helvetica, sans-serif; padding: 40px; color: #111; }
        h1 { color: #2A6174; margin-bottom: 4px; }
        .sub { color: #666; margin-bottom: 30px; }
        table { width:100%; border-collapse:collapse; font-size:13px; }
        th { text-align:left; padding:10px 8px; border-bottom:2px solid #eee; color:#444; }
        td { padding:10px 8px; border-bottom:1px solid #f0f0f0; }
      </style></head><body>
        <h1>WalletWatch Goal Report</h1>
        <p class="sub">${format(currentDate, 'MMMM yyyy')}</p>
        ${
          goalRows.length === 0
            ? '<p>No goal data available for this month.</p>'
            : `
          <table>
            <thead><tr><th>Goal</th><th>Done</th><th>Target</th><th>Completion</th></tr></thead>
            <tbody>
              ${goalRows
                .map(
                  (g) => `
                <tr>
                  <td>${(g.emoji ? `${g.emoji} ` : '') + g.title}</td>
                  <td>${g.done}</td>
                  <td>${g.targetCount}</td>
                  <td>${g.percent.toFixed(0)}%</td>
                </tr>
              `,
                )
                .join('')}
            </tbody>
          </table>
        `
        }
      </body></html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Goal Report' });
    } catch (e) {
      console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Reports</Text>
          <View style={styles.exportGroup}>
            <TouchableOpacity
              style={[
                styles.exportBtn,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
              onPress={handleExportExpenses}
              disabled={exporting || allTx.length === 0}
              activeOpacity={0.8}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Download size={15} color={colors.heading} />
                  <Text style={[styles.exportText, { color: colors.heading }]}>Expense PDF</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.exportBtn,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
              onPress={handleExportGoals}
              disabled={exporting}
              activeOpacity={0.8}
            >
              {exporting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Download size={15} color={colors.heading} />
                  <Text style={[styles.exportText, { color: colors.heading }]}>Goal PDF</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Month switcher */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))} style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronLeft size={18} color={colors.subtext} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>{format(currentDate, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, -1))} style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronRight size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.income }]}>
              {totalIncome.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
              {totalExpenses.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Balance</Text>
            <Text style={[styles.summaryValue, { color: balance >= 0 ? colors.income : colors.expense }]}>
              {Math.abs(balance).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Transactions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Transactions</Text>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : allTx.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No transactions for {format(currentDate, 'MMMM yyyy')}.</Text>
          </View>
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {allTx.map((t, i) => {
              const isIncome = t.type === 'income';
              const Icon = isIncome
                ? ArrowUpRight
                : t.category
                ? iconForCategory(t.category)
                : ArrowDownLeft;
              const color = isIncome
                ? colors.income
                : t.category
                ? colorForCategory(t.category)
                : '#EF4444';

              return (
                <TouchableOpacity
                  key={t.id || `${t.date}-${i}`}
                  style={[styles.txRow, { borderBottomColor: colors.border2 }, i < allTx.length - 1 && styles.txRowBorder]}
                  onPress={() => {
                    if (!t.id) return;
                    router.push({
                      pathname: '/add-transaction',
                      params: { m: format(parseISO(t.date), 'yyyy_MM'), id: t.id },
                    });
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.txIcon, { backgroundColor: color + '18' }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txTitle, { color: colors.text }]}>{isIncome ? 'Income' : t.category}</Text>
                    <Text style={[styles.txNote, { color: colors.muted }]} numberOfLines={1}>
                      {t.note || format(new Date(t.date), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: isIncome ? colors.income : colors.expense }]}>
                      {isIncome ? '+' : '-'}{t.amount.toFixed(2)}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.placeholder }]}>{format(new Date(t.date), 'MMM d')}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>Goal Progress</Text>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 10 }} />
        ) : goalRows.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No goals for {format(currentDate, 'MMMM yyyy')}.</Text>
          </View>
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {goalRows.map((goal, i) => (
              <View
                key={goal.id}
                style={[
                  styles.goalRow,
                  i < goalRows.length - 1 && [styles.txRowBorder, { borderBottomColor: colors.border2 }],
                ]}
              >
                <View style={[styles.goalIcon, { backgroundColor: colors.primaryMuted }]}>
                  <Text style={{ fontSize: 18 }}>{goal.emoji || '🎯'}</Text>
                </View>
                <View style={styles.goalMeta}>
                  <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                    {goal.title}
                  </Text>
                  <View style={[styles.goalProgressTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.goalProgressFill, { width: `${goal.percent}%`, backgroundColor: colors.primary }]} />
                  </View>
                </View>
                <View style={styles.txRight}>
                  <Text style={[styles.txAmount, { color: colors.text }]}>{goal.done}/{goal.targetCount}</Text>
                  <Text style={[styles.txDate, { color: colors.placeholder }]}>{goal.percent.toFixed(0)}%</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  pageTitle: { fontSize: 24, fontWeight: '800' },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  exportGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  exportText: { fontSize: 13, fontWeight: '600' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 20,
  },
  chevronBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  monthText: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 140,
    textAlign: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  summaryCard: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 11, fontWeight: '500' },
  summaryValue: { fontSize: 16, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  emptyCard: {
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },
  txList: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  txRowBorder: {
    borderBottomWidth: 1,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMeta: { flex: 1 },
  txTitle: { fontSize: 14, fontWeight: '600' },
  txNote: { fontSize: 12, marginTop: 1 },
  txRight: { alignItems: 'flex-end' },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txDate: { fontSize: 11, marginTop: 2 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  goalIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalMeta: { flex: 1, gap: 6 },
  goalProgressTrack: { height: 5, borderRadius: 999, overflow: 'hidden' },
  goalProgressFill: { height: '100%', borderRadius: 999 },
});
