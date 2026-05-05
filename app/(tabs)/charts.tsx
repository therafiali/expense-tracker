import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  format,
  subMonths,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ChevronDown,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getMonthData, getSummaries, getCategoryBreakdown, type MonthData } from '@/lib/storage';
import { iconForCategory, colorForCategory } from '@/components/category-icon';
import { useIsFocused } from '@react-navigation/native';

import { useTheme } from '@/lib/theme';
import { Fonts } from '@/constants/fonts';
import { chartGradients, radii } from '@/constants/designTokens';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';

const BAR_TRACK_HEIGHT = 140;
const BAR_MIN_VISIBLE = 10;

export default function ChartsScreen() {
  const scrollRef = useScrollToTopOnFocus();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const isFocused = useIsFocused();
  const { colors } = useTheme();

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, currentDate]);

  const loadData = async () => {
    const monthData = await getMonthData(currentDate);
    setData(monthData);
  };

  const { totalIncome, totalExpenses, balance } = getSummaries(data);
  const breakdown = getCategoryBreakdown(data.expenses);

  const dailyTotals = useMemo(() => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const total = data.expenses
        .filter((e) => isSameDay(parseISO(e.date), day))
        .reduce((s, x) => s + x.amount, 0);
      return {
        day,
        label: format(day, 'EEE'),
        total,
      };
    });
  }, [currentDate, data.expenses]);

  useEffect(() => {
    const today = new Date();
    const idx = dailyTotals.findIndex((d) => isSameDay(d.day, today));
    setSelectedDayIdx(idx >= 0 ? idx : 0);
  }, [dailyTotals]);

  const maxExpense = Math.max(...dailyTotals.map((d) => d.total), 1);

  const inactiveGrad = colors.isDark
    ? (['#356B7A', '#A5E8FD'] as const)
    : chartGradients.barDefault;
  const activeGrad = colors.isDark
    ? (['#8AE2FB', '#2A6174'] as const)
    : chartGradients.barActive;

  const noteBreakdown = React.useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();

    for (const tx of data.expenses) {
      const cleanNote = tx.note?.trim();
      if (!cleanNote) continue;
      const prev = totals.get(cleanNote) ?? { amount: 0, count: 0 };
      totals.set(cleanNote, { amount: prev.amount + tx.amount, count: prev.count + 1 });
    }

    const rows = Array.from(totals.entries())
      .map(([note, stats]) => ({
        note,
        amount: stats.amount,
        count: stats.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    const totalNotedExpense = rows.reduce((sum, row) => sum + row.amount, 0);
    return rows.slice(0, 8).map((row) => ({
      ...row,
      percentage: totalNotedExpense > 0 ? (row.amount / totalNotedExpense) * 100 : 0,
    }));
  }, [data.expenses]);

  const nextMonth = () => setCurrentDate(subMonths(currentDate, -1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const selectedDay = dailyTotals[selectedDayIdx];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: Fonts.extrabold }]}>
            Analytics
          </Text>
        </View>

        <View style={styles.monthRow}>
          <TouchableOpacity
            onPress={prevMonth}
            style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ChevronLeft size={18} color={colors.subtext} />
          </TouchableOpacity>
          <Text style={[styles.monthText, { color: colors.text, fontFamily: Fonts.bold }]}>
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={[styles.chevronBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <ChevronRight size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Weekly bar chart — reference-style rounded gradient bars */}
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity style={styles.chartCardHeader} activeOpacity={0.75}>
            <Text style={[styles.chartCardTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
              Spending this week
            </Text>
            <ChevronDown size={18} color={colors.muted} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.barRow}>
            {dailyTotals.map((d, i) => {
              const active = i === selectedDayIdx;
              const fillRatio = d.total / maxExpense;
              const barH = Math.max(fillRatio * BAR_TRACK_HEIGHT, d.total > 0 ? BAR_MIN_VISIBLE : 6);
              const grad = active ? activeGrad : inactiveGrad;

              return (
                <Pressable
                  key={d.label + format(d.day, 'yyyy-MM-dd')}
                  style={styles.barColumn}
                  onPress={() => setSelectedDayIdx(i)}
                >
                  <View style={[styles.barTrack, { height: BAR_TRACK_HEIGHT }]}>
                    <LinearGradient
                      colors={[...grad]}
                      start={{ x: 0.5, y: 1 }}
                      end={{ x: 0.5, y: 0 }}
                      style={[
                        styles.barFill,
                        {
                          height: barH,
                          opacity: d.total === 0 ? 0.35 : 1,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.dayLabel,
                      {
                        fontFamily: Fonts.medium,
                        color: active ? colors.heading : colors.muted,
                      },
                    ]}
                  >
                    {d.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedDay ? (
            <Text style={[styles.chartFootnote, { color: colors.subtext, fontFamily: Fonts.regular }]}>
              {format(selectedDay.day, 'EEEE, MMM d')}:{' '}
              <Text style={{ fontFamily: Fonts.bold, color: colors.text }}>
                {selectedDay.total.toFixed(2)}
              </Text>{' '}
              expenses
            </Text>
          ) : null}
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.primaryMuted }]}>
            <TrendingUp size={18} color={colors.income} />
            <Text style={[styles.summaryLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Income</Text>
            <Text style={[styles.summaryValue, { color: colors.income, fontFamily: Fonts.bold }]}>
              {totalIncome.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.expenseMuted }]}>
            <TrendingDown size={18} color={colors.expense} />
            <Text style={[styles.summaryLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Expenses</Text>
            <Text style={[styles.summaryValue, { color: colors.expense, fontFamily: Fonts.bold }]}>
              {totalExpenses.toFixed(0)}
            </Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.balanceSymbol, { color: colors.muted }]}>≡</Text>
            <Text style={[styles.summaryLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Balance</Text>
            <Text
              style={[
                styles.summaryValue,
                { color: balance >= 0 ? colors.income : colors.expense, fontFamily: Fonts.bold },
              ]}
            >
              {Math.abs(balance).toFixed(0)}
            </Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          Spending by Category
        </Text>

        {breakdown.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No spending data for {format(currentDate, 'MMMM')}.
            </Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.barContainer}>
              {breakdown.map((item) => (
                <View
                  key={item.category}
                  style={[
                    styles.barSegment,
                    {
                      flex: Math.max(item.percentage, 0.5),
                      backgroundColor: colorForCategory(item.category),
                    },
                  ]}
                />
              ))}
            </View>

            {breakdown.map((item) => {
              const Icon = iconForCategory(item.category);
              const color = colorForCategory(item.category);
              const count = data.expenses.filter((e) => e.category === item.category).length;
              return (
                <View key={item.category} style={[styles.catRow, { borderTopColor: colors.border2 }]}>
                  <View style={[styles.catIcon, { backgroundColor: color + '18' }]}>
                    <Icon size={18} color={color} />
                  </View>
                  <View style={styles.catMeta}>
                    <View style={styles.catNameRow}>
                      <Text style={[styles.catName, { color: colors.text, fontFamily: Fonts.semibold }]}>
                        {item.category}
                      </Text>
                      <Text style={[styles.catAmount, { color: colors.text, fontFamily: Fonts.bold }]}>
                        {item.amount.toFixed(0)}
                      </Text>
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
                      <Text style={[styles.catPercent, { color: colors.muted, fontFamily: Fonts.medium }]}>
                        {item.percentage.toFixed(0)}%
                      </Text>
                    </View>
                    <Text style={[styles.catCount, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
                      {count} transaction{count !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22, fontFamily: Fonts.bold }]}>
          Spending by Notes
        </Text>
        {noteBreakdown.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No note-based stats for {format(currentDate, 'MMMM')}.
            </Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {noteBreakdown.map((item) => (
              <View key={item.note} style={[styles.noteRow, { borderTopColor: colors.border2 }]}>
                <View style={styles.noteMeta}>
                  <View style={styles.noteHead}>
                    <Text style={[styles.noteText, { color: colors.text, fontFamily: Fonts.semibold }]} numberOfLines={1}>
                      {item.note}
                    </Text>
                    <Text style={[styles.noteAmount, { color: colors.text, fontFamily: Fonts.bold }]}>
                      {item.amount.toFixed(0)}
                    </Text>
                  </View>
                  <View style={styles.noteBarRow}>
                    <View style={[styles.catBarBg, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.catBarFill,
                          { width: `${item.percentage}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                    <Text style={[styles.catPercent, { color: colors.muted, fontFamily: Fonts.medium }]}>
                      {item.percentage.toFixed(0)}%
                    </Text>
                  </View>
                  <Text style={[styles.catCount, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
                    {item.count} transaction{item.count !== 1 ? 's' : ''}
                  </Text>
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
  chartCard: {
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  chartCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  chartCardTitle: { fontSize: 16, fontWeight: '700' },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: '100%',
    justifyContent: 'flex-end',
    marginBottom: 10,
  },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  dayLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
  chartFootnote: {
    marginTop: 16,
    fontSize: 13,
    textAlign: 'center',
  },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  summaryCard: {
    flex: 1,
    borderRadius: radii.md,
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
    borderRadius: radii.md,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: { fontSize: 14 },
  breakdownList: {
    borderRadius: radii.md,
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
  noteRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  noteMeta: { gap: 5 },
  noteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  noteText: { flex: 1, fontSize: 14, fontWeight: '600' },
  noteAmount: { fontSize: 14, fontWeight: '700' },
  noteBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
