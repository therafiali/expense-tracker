import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';

import {
  getMonthData,
  getSummaries,
  type MonthData,
  type Transaction,
} from '@/lib/storage';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/category-icon';

import { useTheme } from '@/lib/theme';

export default function HomeScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();
  const { colors, isDark } = useTheme();

  const loadData = useCallback(async () => {
    setLoading(true);
    const monthData = await getMonthData(currentDate);
    setData(monthData);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  const { totalIncome, totalExpenses, balance } = getSummaries(data);

  const allTransactions: Transaction[] = [
    ...data.income.map((t) => ({ ...t, type: 'income' as const })),
    ...data.expenses.map((t) => ({ ...t, type: 'expense' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#10B981" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>WalletWatch</Text>
            <Text style={[styles.subGreeting, { color: colors.muted }]}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.balanceLabel, { color: colors.muted }]}>Total Balance</Text>
          <Text style={[styles.balanceValue, { color: balance >= 0 ? colors.text : '#EF4444' }]}>
            {balance < 0 ? '-' : ''}{Math.abs(balance).toFixed(2)}
          </Text>
          {/* Month switcher */}
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => setCurrentDate(subMonths(currentDate, 1))} style={[styles.chevronBtn, { backgroundColor: colors.card2 }]}>
              <ChevronLeft size={16} color={colors.subtext} />
            </TouchableOpacity>
            <Text style={[styles.monthText, { color: colors.subtext }]}>{format(currentDate, 'MMMM yyyy')}</Text>
            <TouchableOpacity onPress={() => setCurrentDate(addMonths(currentDate, 1))} style={[styles.chevronBtn, { backgroundColor: colors.card2 }]}>
              <ChevronRight size={16} color={colors.subtext} />
            </TouchableOpacity>
          </View>

          {/* Income / Expense strip */}
          <View style={[styles.statsRow, { backgroundColor: colors.bg }]}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#10B981' }]} />
              <View>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Income</Text>
                <Text style={styles.statIncome}>{totalIncome.toFixed(0)}</Text>
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#EF4444' }]} />
              <View>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Expenses</Text>
                <Text style={styles.statExpense}>{totalExpenses.toFixed(0)}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Transactions */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>All Transactions</Text>

        {allTransactions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No transactions this month yet.</Text>
            <Text style={[styles.emptySubText, { color: colors.placeholder }]}>Tap + to add your first one!</Text>
          </View>
        ) : (
          <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {allTransactions.map((t, i) => {
              const isIncome = t.type === 'income';
              const Icon = isIncome
                ? ArrowUpRight
                : t.category
                ? CATEGORY_ICONS[t.category]
                : ArrowDownLeft;
              const color = isIncome
                ? '#10B981'
                : t.category
                ? CATEGORY_COLORS[t.category]
                : '#EF4444';

              return (
                <View
                  key={t.id || `${t.date}-${i}`}
                  style={[
                    styles.txRow,
                    i < allTransactions.length - 1 && [styles.txRowBorder, { borderBottomColor: colors.border2 }],
                  ]}
                >
                  <View style={[styles.txIcon, { backgroundColor: color + '18' }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <View style={styles.txMeta}>
                    <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                      {isIncome ? 'Income' : t.category}
                    </Text>
                    <Text style={[styles.txNote, { color: colors.muted }]} numberOfLines={1}>
                      {t.note || format(new Date(t.date), 'MMM d, h:mm a')}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text style={[styles.txAmount, { color: isIncome ? '#10B981' : '#EF4444' }]}>
                      {isIncome ? '+' : '-'}{t.amount.toFixed(2)}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.placeholder }]}>{format(new Date(t.date), 'MMM d')}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800' },
  subGreeting: { fontSize: 13, marginTop: 2 },
  // Balance Card
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    gap: 8,
  },
  balanceLabel: { fontSize: 13, fontWeight: '500' },
  balanceValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1 },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    marginBottom: 4,
  },
  chevronBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthText: { fontSize: 14, fontWeight: '600' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginTop: 8,
  },
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 11 },
  statIncome: { fontSize: 15, fontWeight: '700', color: '#10B981' },
  statExpense: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  statDivider: { width: 1, height: 32, marginHorizontal: 8 },
  // Section
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  // Empty
  emptyCard: {
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },
  emptySubText: { fontSize: 12 },
  // Transaction list
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
});
