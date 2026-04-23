import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react-native';
import { getMonthData, getSummaries, getCategoryBreakdown, type MonthData } from '@/lib/storage';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/category-icon';
import { useIsFocused } from '@react-navigation/native';

import { useTheme } from '@/lib/theme';

export default function ChartsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, currentDate]);

  const loadData = async () => {
    setLoading(true);
    const monthData = await getMonthData(currentDate);
    setData(monthData);
    setLoading(false);
  };

  const { totalIncome, totalExpenses, balance } = getSummaries(data);
  const breakdown = getCategoryBreakdown(data.expenses);

  const nextMonth = () => setCurrentDate(subMonths(currentDate, -1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Analytics</Text>
        </View>

        {/* Month Switcher */}
        <View style={styles.monthRow}>
          <TouchableOpacity onPress={prevMonth} style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronLeft size={18} color={colors.subtext} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text }]}>{format(currentDate, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={nextMonth} style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ChevronRight size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: '#10B98130' }]}>
            <TrendingUp size={18} color="#10B981" />
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: '#10B981' }]}>
              {totalIncome.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: '#EF444430' }]}>
            <TrendingDown size={18} color="#EF4444" />
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: '#EF4444' }]}>
              {totalExpenses.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.balanceSymbol, { color: colors.muted }]}>≡</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted }]}>Balance</Text>
            <Text style={[styles.summaryValue, { color: balance >= 0 ? '#10B981' : '#EF4444' }]}>
              {Math.abs(balance).toFixed(0)}
            </Text>
          </View>
        </View>

        {/* Category Breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending by Category</Text>

        {breakdown.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No spending data for {format(currentDate, 'MMMM')}.</Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Bar chart overview */}
            <View style={styles.barContainer}>
              {breakdown.map((item) => (
                <View
                  key={item.category}
                  style={[
                    styles.barSegment,
                    {
                      flex: item.percentage,
                      backgroundColor: CATEGORY_COLORS[item.category],
                    },
                  ]}
                />
              ))}
            </View>

            {/* Category rows */}
            {breakdown.map((item) => {
              const Icon = CATEGORY_ICONS[item.category];
              const color = CATEGORY_COLORS[item.category];
              const count = data.expenses.filter(e => e.category === item.category).length;
              return (
                <View key={item.category} style={[styles.catRow, { borderTopColor: colors.border2 }]}>
                  <View style={[styles.catIcon, { backgroundColor: color + '18' }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <View style={styles.catMeta}>
                    <View style={styles.catNameRow}>
                      <Text style={[styles.catName, { color: colors.text }]}>{item.category}</Text>
                      <Text style={[styles.catAmount, { color: colors.text }]}>{item.amount.toFixed(0)}</Text>
                    </View>
                    <View style={styles.catBarRow}>
                      <View style={[styles.catBarBg, { backgroundColor: colors.border }]}>
                        <View
                          style={[
                            styles.catBarFill,
                            { width: `${item.percentage}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                      <Text style={[styles.catPercent, { color: colors.muted }]}>{item.percentage.toFixed(0)}%</Text>
                    </View>
                    <Text style={[styles.catCount, { color: colors.placeholder }]}>{count} transaction{count !== 1 ? 's' : ''}</Text>
                  </View>
                </View>
              );
            })}
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
  header: { paddingTop: 20, paddingBottom: 8 },
  pageTitle: { fontSize: 24, fontWeight: '800' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
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
  monthText: { fontSize: 16, fontWeight: '700', minWidth: 140, textAlign: 'center' },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  summaryCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
  },
  summaryLabel: { fontSize: 11, fontWeight: '500' },
  summaryValue: { fontSize: 17, fontWeight: '800' },
  balanceSymbol: { fontSize: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 14 },
  emptyCard: {
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },
  breakdownList: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
  },
  barContainer: {
    flexDirection: 'row',
    height: 6,
    overflow: 'hidden',
  },
  barSegment: { height: 6 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderTopWidth: 1,
  },
  catIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catMeta: { flex: 1, gap: 4 },
  catNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  catName: { fontSize: 14, fontWeight: '600' },
  catAmount: { fontSize: 14, fontWeight: '700' },
  catBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catBarBg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  catBarFill: { height: 4, borderRadius: 2 },
  catPercent: { fontSize: 11, minWidth: 30, textAlign: 'right' },
  catCount: { fontSize: 11 },
});
