import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  DeviceEventEmitter,
  TextInput,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  format,
  subMonths,
  startOfWeek,
  addDays,
  isSameDay,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  SlidersHorizontal,
  AlertCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getSummaries } from '@/lib/storage';
import { getActiveGoals, getGoalProgress } from '@/lib/goals';
import { iconForCategory, colorForCategory } from '@/components/category-icon';
import { useIsFocused } from '@react-navigation/native';

import { useTheme } from '@/lib/theme';
import { DATA_SYNCED_EVENT } from '@/lib/sync';
import { Fonts } from '@/constants/fonts';
import { chartGradients, radii } from '@/constants/designTokens';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';
import {
  applyAnalyticsFilters,
  collectCategories,
  computeCategoryShareOverTime,
  computeMonthlyTrend,
  countMissingDetails,
  getDateRangeForPreset,
  getDynamicCategoryBreakdown,
  getIncomeSourceBreakdown,
  getTransactionsForMonths,
  getTransactionsInRange,
  getTrendMonthStarts,
  normalizeCategory,
  sumByCategories,
  toTypedTransactions,
  FOOD_SNACKING_CATEGORIES,
  VEHICLE_CATEGORIES,
  type AnalyticsFilters,
  type DatePreset,
  type NoteFilter,
  type TypeFilter,
} from '@/lib/analytics';

const BAR_TRACK_HEIGHT = 140;
const BAR_MIN_VISIBLE = 10;
const TREND_BAR_HEIGHT = 100;

type DatePickerTarget = 'from' | 'to';

const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: 'thisMonth', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
];

const TYPE_FILTERS: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'income', label: 'Income' },
  { id: 'expense', label: 'Expense' },
];

const NOTE_FILTERS: { id: NoteFilter; label: string }[] = [
  { id: 'all', label: 'Any note' },
  { id: 'hasNote', label: 'Has note' },
  { id: 'missingNote', label: 'Missing note' },
];

export default function ChartsScreen() {
  const scrollRef = useScrollToTopOnFocus();
  const [datePreset, setDatePreset] = useState<DatePreset>('thisMonth');
  const [customFrom, setCustomFrom] = useState<string | null>(null);
  const [customTo, setCustomTo] = useState<string | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rangeTx, setRangeTx] = useState<ReturnType<typeof toTypedTransactions>>([]);
  const [trendTx, setTrendTx] = useState<ReturnType<typeof toTypedTransactions>>([]);
  const [filters, setFilters] = useState<AnalyticsFilters>({
    categories: [],
    type: 'all',
    search: '',
    noteFilter: 'all',
  });
  const [amountMinText, setAmountMinText] = useState('');
  const [amountMaxText, setAmountMaxText] = useState('');
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [goalRows, setGoalRows] = useState<
    Array<{ id: string; title: string; emoji?: string; targetCount: number; done: number; percent: number }>
  >([]);
  const isFocused = useIsFocused();
  const { colors } = useTheme();

  const rangeBounds = useMemo(
    () =>
      getDateRangeForPreset(
        datePreset,
        customFrom ? parseISO(customFrom) : null,
        customTo ? parseISO(customTo) : null,
      ),
    [datePreset, customFrom, customTo],
  );

  const trendMonthStarts = useMemo(
    () => getTrendMonthStarts(rangeBounds.to, 6),
    [rangeBounds.to],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    const [rangeData, trendData] = await Promise.all([
      getTransactionsInRange(rangeBounds.from, rangeBounds.to),
      getTransactionsForMonths(trendMonthStarts),
    ]);
    setRangeTx(toTypedTransactions(rangeData));
    setTrendTx(toTypedTransactions(trendData));

    const focusMonth = startOfMonth(rangeBounds.to);
    const monthPrefix = format(focusMonth, 'yyyy-MM');
    const [goals, progress] = await Promise.all([getActiveGoals(), getGoalProgress()]);
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
        return {
          id: goal.id,
          title: goal.title,
          emoji: goal.emoji,
          targetCount: target,
          done,
          percent,
        };
      })
      .sort((a, b) => b.percent - a.percent);
    setGoalRows(rows);
    setLoading(false);
  }, [rangeBounds.from, rangeBounds.to, trendMonthStarts]);

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused, loadData]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(DATA_SYNCED_EVENT, () => {
      if (!isFocused) return;
      void loadData();
    });
    return () => sub.remove();
  }, [isFocused, loadData]);

  const resolvedFilters = useMemo((): AnalyticsFilters => {
    const amountMin = amountMinText.trim() ? parseFloat(amountMinText) : undefined;
    const amountMax = amountMaxText.trim() ? parseFloat(amountMaxText) : undefined;
    return {
      ...filters,
      amountMin: amountMin != null && !Number.isNaN(amountMin) ? amountMin : undefined,
      amountMax: amountMax != null && !Number.isNaN(amountMax) ? amountMax : undefined,
    };
  }, [filters, amountMinText, amountMaxText]);

  const filteredTx = useMemo(
    () => applyAnalyticsFilters(rangeTx, resolvedFilters),
    [rangeTx, resolvedFilters],
  );

  const filteredTrendTx = useMemo(
    () => applyAnalyticsFilters(trendTx, resolvedFilters),
    [trendTx, resolvedFilters],
  );

  const filteredData = useMemo(() => {
    const income = filteredTx.filter((t) => t.type === 'income');
    const expenses = filteredTx.filter((t) => t.type === 'expense');
    return { income, expenses };
  }, [filteredTx]);

  const { totalIncome, totalExpenses, balance } = getSummaries(filteredData);
  const breakdown = getDynamicCategoryBreakdown(filteredData.expenses);
  const availableCategories = useMemo(() => collectCategories(rangeTx), [rangeTx]);

  const monthlyTrend = useMemo(
    () => computeMonthlyTrend(filteredTrendTx, trendMonthStarts),
    [filteredTrendTx, trendMonthStarts],
  );

  const categoryOverTime = useMemo(
    () => computeCategoryShareOverTime(filteredTrendTx, trendMonthStarts),
    [filteredTrendTx, trendMonthStarts],
  );

  const incomeSources = useMemo(
    () => getIncomeSourceBreakdown(filteredData.income),
    [filteredData.income],
  );

  const foodSnackingTotal = useMemo(
    () => sumByCategories(filteredData.expenses, FOOD_SNACKING_CATEGORIES),
    [filteredData.expenses],
  );

  const vehicleTotal = useMemo(
    () => sumByCategories(filteredData.expenses, VEHICLE_CATEGORIES),
    [filteredData.expenses],
  );

  const missingDetails = useMemo(() => countMissingDetails(filteredTx), [filteredTx]);

  const noteBreakdown = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    for (const tx of filteredData.expenses) {
      const cleanNote = tx.note?.trim();
      if (!cleanNote) continue;
      const prev = totals.get(cleanNote) ?? { amount: 0, count: 0 };
      totals.set(cleanNote, { amount: prev.amount + tx.amount, count: prev.count + 1 });
    }
    const rows = [...totals.entries()]
      .map(([note, stats]) => ({ note, amount: stats.amount, count: stats.count }))
      .sort((a, b) => b.amount - a.amount);
    const totalNotedExpense = rows.reduce((sum, row) => sum + row.amount, 0);
    return rows.slice(0, 8).map((row) => ({
      ...row,
      percentage: totalNotedExpense > 0 ? (row.amount / totalNotedExpense) * 100 : 0,
    }));
  }, [filteredData.expenses]);

  const dailyTotals = useMemo(() => {
    const weekStart = startOfWeek(rangeBounds.to, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(weekStart, i);
      const total = filteredData.expenses
        .filter((e) => isSameDay(parseISO(e.date), day))
        .reduce((s, x) => s + x.amount, 0);
      return { day, label: format(day, 'EEE'), total };
    });
  }, [filteredData.expenses, rangeBounds.to]);

  useEffect(() => {
    const today = new Date();
    const idx = dailyTotals.findIndex((d) => isSameDay(d.day, today));
    setSelectedDayIdx(idx >= 0 ? idx : 0);
  }, [dailyTotals]);

  const maxExpense = Math.max(...dailyTotals.map((d) => d.total), 1);
  const maxTrendValue = Math.max(...monthlyTrend.flatMap((m) => [m.income, m.expense]), 1);

  const inactiveGrad = colors.isDark
    ? (['#356B7A', '#A5E8FD'] as const)
    : chartGradients.barDefault;
  const activeGrad = colors.isDark
    ? (['#8AE2FB', '#2A6174'] as const)
    : chartGradients.barActive;

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.type !== 'all' ||
    filters.noteFilter !== 'all' ||
    filters.search.trim().length > 0 ||
    amountMinText.trim().length > 0 ||
    amountMaxText.trim().length > 0;

  const clearFilters = () => {
    setFilters({ categories: [], type: 'all', search: '', noteFilter: 'all' });
    setAmountMinText('');
    setAmountMaxText('');
  };

  const toggleCategory = (cat: string) => {
    setFilters((prev) => {
      const normalized = normalizeCategory(cat);
      const has = prev.categories.some((c) => normalizeCategory(c) === normalized);
      return {
        ...prev,
        categories: has
          ? prev.categories.filter((c) => normalizeCategory(c) !== normalized)
          : [...prev.categories, normalized],
      };
    });
  };

  const openDatePicker = (target: DatePickerTarget) => {
    const selected = target === 'from' ? customFrom : customTo;
    setCalendarMonth(selected ? parseISO(selected) : rangeBounds.from);
    setDatePickerTarget(target);
    setDatePreset('custom');
  };

  const applyPickedDate = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    if (datePickerTarget === 'from') {
      setCustomFrom(key);
      if (customTo && key > customTo) setCustomTo(key);
    } else if (datePickerTarget === 'to') {
      setCustomTo(key);
      if (customFrom && key < customFrom) setCustomFrom(key);
    }
    setDatePickerTarget(null);
    setDatePreset('custom');
  };

  const rangeLabel =
    datePreset === 'custom'
      ? `${format(rangeBounds.from, 'd MMM')} – ${format(rangeBounds.to, 'd MMM yyyy')}`
      : format(rangeBounds.from, 'MMMM yyyy');

  const selectedDay = dailyTotals[selectedDayIdx];

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
    const end = endOfMonth(calendarMonth);
    const endWeek = addDays(startOfWeek(end, { weekStartsOn: 0 }), 6);
    return eachDayOfInterval({ start, end: endWeek });
  }, [calendarMonth]);

  const selectedPickerDate =
    datePickerTarget === 'from' && customFrom
      ? parseISO(customFrom)
      : datePickerTarget === 'to' && customTo
        ? parseISO(customTo)
        : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={[styles.pageTitle, { color: colors.text, fontFamily: Fonts.extrabold }]}>
            Analytics
          </Text>
          <TouchableOpacity
            style={[
              styles.filterToggle,
              { backgroundColor: colors.card, borderColor: hasActiveFilters ? colors.primary : colors.border },
            ]}
            onPress={() => setShowFilters((v) => !v)}
            activeOpacity={0.8}
          >
            <SlidersHorizontal size={16} color={hasActiveFilters ? colors.heading : colors.muted} />
            <Text
              style={[
                styles.filterToggleText,
                { color: hasActiveFilters ? colors.heading : colors.subtext, fontFamily: Fonts.semibold },
              ]}
            >
              Filters
            </Text>
            {hasActiveFilters ? (
              <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.presetRow}>
          {DATE_PRESETS.map((preset) => {
            const active = datePreset === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetChip,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
                onPress={() => {
                  setDatePreset(preset.id);
                  if (preset.id !== 'custom') {
                    setCustomFrom(null);
                    setCustomTo(null);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    { color: active ? colors.heading : colors.subtext, fontFamily: Fonts.medium },
                    active && { fontFamily: Fonts.bold },
                  ]}
                >
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.rangeLabel, { color: colors.muted, fontFamily: Fonts.regular }]}>
          {rangeLabel}
          {filteredTx.length !== rangeTx.length
            ? ` · ${filteredTx.length} of ${rangeTx.length} transactions`
            : ''}
        </Text>

        {datePreset === 'custom' ? (
          <View style={styles.customDateRow}>
            <TouchableOpacity
              style={[
                styles.dateChip,
                { backgroundColor: colors.card, borderColor: colors.border },
                customFrom && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
              onPress={() => openDatePicker('from')}
            >
              <Text style={{ color: customFrom ? colors.heading : colors.subtext, fontFamily: Fonts.medium }}>
                {customFrom ? format(parseISO(customFrom), 'd MMM yyyy') : 'From date'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dateChip,
                { backgroundColor: colors.card, borderColor: colors.border },
                customTo && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
              onPress={() => openDatePicker('to')}
            >
              <Text style={{ color: customTo ? colors.heading : colors.subtext, fontFamily: Fonts.medium }}>
                {customTo ? format(parseISO(customTo), 'd MMM yyyy') : 'To date'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {showFilters ? (
          <View style={[styles.filtersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.filtersHeader}>
              <Text style={[styles.filtersTitle, { color: colors.text, fontFamily: Fonts.bold }]}>Filters</Text>
              {hasActiveFilters ? (
                <TouchableOpacity onPress={clearFilters} hitSlop={8}>
                  <Text style={{ color: colors.heading, fontFamily: Fonts.semibold }}>Clear</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={[styles.searchWrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Search size={16} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text, fontFamily: Fonts.regular }]}
                placeholder="Search note, category, amount"
                placeholderTextColor={colors.placeholder}
                value={filters.search}
                onChangeText={(search) => setFilters((prev) => ({ ...prev, search }))}
                autoCorrect={false}
              />
              {filters.search.length > 0 ? (
                <TouchableOpacity onPress={() => setFilters((prev) => ({ ...prev, search: '' }))}>
                  <X size={16} color={colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <Text style={[styles.filterLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Type</Text>
            <View style={styles.chipRow}>
              {TYPE_FILTERS.map((item) => {
                const active = filters.type === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                      active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                    ]}
                    onPress={() => setFilters((prev) => ({ ...prev, type: item.id }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.heading : colors.subtext, fontFamily: Fonts.medium },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.filterLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Note</Text>
            <View style={styles.chipRow}>
              {NOTE_FILTERS.map((item) => {
                const active = filters.noteFilter === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.chip,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                      active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                    ]}
                    onPress={() => setFilters((prev) => ({ ...prev, noteFilter: item.id }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? colors.heading : colors.subtext, fontFamily: Fonts.medium },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.filterLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>Amount range</Text>
            <View style={styles.amountRow}>
              <TextInput
                style={[styles.amountInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="Min"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                value={amountMinText}
                onChangeText={setAmountMinText}
              />
              <Text style={{ color: colors.muted }}>–</Text>
              <TextInput
                style={[styles.amountInput, { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text }]}
                placeholder="Max"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                value={amountMaxText}
                onChangeText={setAmountMaxText}
              />
            </View>

            {availableCategories.length > 0 ? (
              <>
                <Text style={[styles.filterLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>
                  Category
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {availableCategories.map((cat) => {
                    const active = filters.categories.some((c) => normalizeCategory(c) === cat);
                    return (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.chip,
                          { backgroundColor: colors.bg, borderColor: colors.border },
                          active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                        ]}
                        onPress={() => toggleCategory(cat)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: active ? colors.heading : colors.subtext, fontFamily: Fonts.medium },
                          ]}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : null}
          </View>
        ) : null}

        {(missingDetails.missingNote > 0 || missingDetails.uncategorizedExpense > 0) && (
          <View style={[styles.alertCard, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
            <AlertCircle size={18} color={colors.heading} />
            <View style={styles.alertMeta}>
              <Text style={[styles.alertTitle, { color: colors.heading, fontFamily: Fonts.semibold }]}>
                Missing detail in filtered results
              </Text>
              <Text style={[styles.alertBody, { color: colors.subtext, fontFamily: Fonts.regular }]}>
                {missingDetails.missingNote} without note
                {missingDetails.uncategorizedExpense > 0
                  ? ` · ${missingDetails.uncategorizedExpense} uncategorized expense`
                  : ''}
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
          Monthly income vs expense
        </Text>
        {monthlyTrend.every((m) => m.income === 0 && m.expense === 0) ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No trend data for the last 6 months.
            </Text>
          </View>
        ) : (
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.trendLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.income }]} />
                <Text style={{ color: colors.muted, fontFamily: Fonts.regular, fontSize: 11 }}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.expense }]} />
                <Text style={{ color: colors.muted, fontFamily: Fonts.regular, fontSize: 11 }}>Expense</Text>
              </View>
            </View>
            <View style={styles.trendRow}>
              {monthlyTrend.map((month) => (
                <View key={month.monthKey} style={styles.trendColumn}>
                  <View style={[styles.trendTrack, { height: TREND_BAR_HEIGHT }]}>
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: Math.max((month.income / maxTrendValue) * TREND_BAR_HEIGHT, month.income > 0 ? 4 : 0),
                          backgroundColor: colors.income,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.trendBar,
                        {
                          height: Math.max((month.expense / maxTrendValue) * TREND_BAR_HEIGHT, month.expense > 0 ? 4 : 0),
                          backgroundColor: colors.expense,
                          marginLeft: 3,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.trendLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>
                    {month.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold, marginTop: 22 }]}>
          Category share over time
        </Text>
        {categoryOverTime.every((m) => m.totalExpense === 0) ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No category trend data yet.
            </Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {categoryOverTime.map((month) => (
              <View key={month.monthKey} style={[styles.stackRow, { borderTopColor: colors.border2 }]}>
                <View style={styles.stackHead}>
                  <Text style={[styles.stackMonth, { color: colors.text, fontFamily: Fonts.semibold }]}>
                    {month.label}
                  </Text>
                  <Text style={{ color: colors.muted, fontFamily: Fonts.regular, fontSize: 11 }}>
                    {month.totalExpense.toFixed(0)} spent
                  </Text>
                </View>
                {month.totalExpense > 0 ? (
                  <>
                    <View style={styles.stackBar}>
                      {month.segments.map((seg) => (
                        <View
                          key={seg.category}
                          style={[
                            styles.stackSegment,
                            {
                              flex: Math.max(seg.percentage, 0.5),
                              backgroundColor: seg.colorKey,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <View style={styles.stackLegend}>
                      {month.segments.slice(0, 4).map((seg) => (
                        <Text
                          key={seg.category}
                          style={{ color: colors.muted, fontFamily: Fonts.regular, fontSize: 10 }}
                          numberOfLines={1}
                        >
                          {seg.category} {seg.percentage.toFixed(0)}%
                        </Text>
                      ))}
                    </View>
                  </>
                ) : (
                  <Text style={{ color: colors.placeholder, fontFamily: Fonts.regular, fontSize: 12 }}>
                    No expenses
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: Fonts.bold, marginTop: 22 }]}>
          Rollups
        </Text>
        <View style={styles.rollupRow}>
          <View style={[styles.rollupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rollupLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>
              Food & Snacking
            </Text>
            <Text style={[styles.rollupValue, { color: '#F59E0B', fontFamily: Fonts.bold }]}>
              {foodSnackingTotal.toFixed(0)}
            </Text>
            <Text style={[styles.rollupHint, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
              Food + Craving
            </Text>
          </View>
          <View style={[styles.rollupCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.rollupLabel, { color: colors.muted, fontFamily: Fonts.medium }]}>
              Vehicle costs
            </Text>
            <Text style={[styles.rollupValue, { color: '#3B82F6', fontFamily: Fonts.bold }]}>
              {vehicleTotal.toFixed(0)}
            </Text>
            <Text style={[styles.rollupHint, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
              Petrol + Repair
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              marginTop: 22,
            },
          ]}
        >
          <Text style={[styles.chartCardTitle, { color: colors.text, fontFamily: Fonts.bold }]}>
            Spending this week
          </Text>
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
                        { height: barH, opacity: d.total === 0 ? 0.35 : 1 },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.dayLabel,
                      { fontFamily: Fonts.medium, color: active ? colors.heading : colors.muted },
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
              No spending data for this range.
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
                    { flex: Math.max(item.percentage, 0.5), backgroundColor: colorForCategory(item.category) },
                  ]}
                />
              ))}
            </View>
            {breakdown.map((item) => {
              const Icon = iconForCategory(item.category);
              const color = colorForCategory(item.category);
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
                          style={[styles.catBarFill, { width: `${item.percentage}%`, backgroundColor: color }]}
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
              );
            })}
          </View>
        )}

        {incomeSources.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22, fontFamily: Fonts.bold }]}>
              Income sources
            </Text>
            <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {incomeSources.map((item) => (
                <View key={item.source} style={[styles.noteRow, { borderTopColor: colors.border2 }]}>
                  <View style={styles.noteMeta}>
                    <View style={styles.noteHead}>
                      <Text style={[styles.noteText, { color: colors.text, fontFamily: Fonts.semibold }]}>
                        {item.source}
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
                            { width: `${item.percentage}%`, backgroundColor: colors.income },
                          ]}
                        />
                      </View>
                      <Text style={[styles.catPercent, { color: colors.muted, fontFamily: Fonts.medium }]}>
                        {item.percentage.toFixed(0)}%
                      </Text>
                    </View>
                    <Text style={[styles.catCount, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
                      {item.count} entry{item.count !== 1 ? 's' : ''}
                      {item.source === 'Untagged' ? ' · add notes like Salary or Transfer' : ''}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22, fontFamily: Fonts.bold }]}>
          Spending by Notes
        </Text>
        {noteBreakdown.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No note-based stats for this range.
            </Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {noteBreakdown.map((item) => (
              <View key={item.note} style={[styles.noteRow, { borderTopColor: colors.border2 }]}>
                <View style={styles.noteMeta}>
                  <View style={styles.noteHead}>
                    <Text
                      style={[styles.noteText, { color: colors.text, fontFamily: Fonts.semibold }]}
                      numberOfLines={1}
                    >
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

        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22, fontFamily: Fonts.bold }]}>
          Goal Progress
        </Text>
        {goalRows.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted, fontFamily: Fonts.regular }]}>
              No goals found. Add goals to see monthly progress.
            </Text>
          </View>
        ) : (
          <View style={[styles.breakdownList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {goalRows.map((goal) => (
              <View key={goal.id} style={[styles.noteRow, { borderTopColor: colors.border2 }]}>
                <View style={styles.noteMeta}>
                  <View style={styles.noteHead}>
                    <Text
                      style={[styles.noteText, { color: colors.text, fontFamily: Fonts.semibold }]}
                      numberOfLines={1}
                    >
                      {goal.emoji ? `${goal.emoji} ${goal.title}` : goal.title}
                    </Text>
                    <Text style={[styles.noteAmount, { color: colors.text, fontFamily: Fonts.bold }]}>
                      {goal.done}/{goal.targetCount}
                    </Text>
                  </View>
                  <View style={styles.noteBarRow}>
                    <View style={[styles.catBarBg, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.catBarFill,
                          { width: `${goal.percent}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                    <Text style={[styles.catPercent, { color: colors.muted, fontFamily: Fonts.medium }]}>
                      {goal.percent.toFixed(0)}%
                    </Text>
                  </View>
                  <Text style={[styles.catCount, { color: colors.placeholder, fontFamily: Fonts.regular }]}>
                    Completion in {format(rangeBounds.to, 'MMMM')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={datePickerTarget != null} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setDatePickerTarget(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
                <ChevronLeft size={20} color={colors.subtext} />
              </TouchableOpacity>
              <Text style={{ color: colors.text, fontFamily: Fonts.bold }}>
                {format(calendarMonth, 'MMMM yyyy')}
              </Text>
              <TouchableOpacity onPress={() => setCalendarMonth(subMonths(calendarMonth, -1))}>
                <ChevronRight size={20} color={colors.subtext} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRow}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <Text key={`${d}-${i}`} style={[styles.weekday, { color: colors.muted }]}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const inMonth = isSameMonth(day, calendarMonth);
                const selected = selectedPickerDate ? isSameDay(day, selectedPickerDate) : false;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.calendarDay,
                      selected && { backgroundColor: colors.primaryMuted },
                    ]}
                    onPress={() => applyPickedDate(day)}
                    disabled={!inMonth}
                  >
                    <Text
                      style={{
                        color: !inMonth ? colors.border : selected ? colors.heading : colors.text,
                        fontFamily: selected ? Fonts.bold : Fonts.regular,
                      }}
                    >
                      {format(day, 'd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 8,
  },
  pageTitle: { fontSize: 24, fontWeight: '800' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterToggleText: { fontSize: 13 },
  filterDot: { width: 6, height: 6, borderRadius: 3 },
  presetRow: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  presetChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  presetChipText: { fontSize: 13 },
  rangeLabel: { fontSize: 13, marginTop: 10, marginBottom: 4 },
  customDateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  dateChip: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  filtersCard: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    marginTop: 12,
    marginBottom: 8,
    gap: 10,
  },
  filtersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  filtersTitle: { fontSize: 15 },
  filterLabel: { fontSize: 12, marginTop: 4 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  amountInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 12,
  },
  alertMeta: { flex: 1, gap: 2 },
  alertTitle: { fontSize: 13 },
  alertBody: { fontSize: 12 },
  chartCard: {
    borderRadius: radii.xl,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    marginBottom: 8,
    borderWidth: 1,
  },
  chartCardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
  },
  barColumn: { flex: 1, alignItems: 'center' },
  barTrack: { width: '100%', justifyContent: 'flex-end', marginBottom: 10 },
  barFill: {
    width: '100%',
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  dayLabel: { fontSize: 11, textAlign: 'center' },
  chartFootnote: { marginTop: 16, fontSize: 13, textAlign: 'center' },
  trendLegend: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 4 },
  trendColumn: { flex: 1, alignItems: 'center' },
  trendTrack: { flexDirection: 'row', alignItems: 'flex-end', width: '100%', justifyContent: 'center' },
  trendBar: { flex: 1, borderRadius: 4, maxWidth: 14 },
  trendLabel: { fontSize: 10, marginTop: 8, textAlign: 'center' },
  rollupRow: { flexDirection: 'row', gap: 10 },
  rollupCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 14,
    gap: 4,
  },
  rollupLabel: { fontSize: 12 },
  rollupValue: { fontSize: 20, fontWeight: '800' },
  rollupHint: { fontSize: 11 },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 28, marginTop: 16 },
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
    marginBottom: 4,
  },
  barContainer: { flexDirection: 'row', height: 6, overflow: 'hidden' },
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
  catBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  catBarFill: { height: 4, borderRadius: 2 },
  catPercent: { fontSize: 11, minWidth: 30, textAlign: 'right' },
  catCount: { fontSize: 11 },
  stackRow: { padding: 14, borderTopWidth: 1, gap: 8 },
  stackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stackMonth: { fontSize: 14 },
  stackBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden' },
  stackSegment: { height: 8 },
  stackLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noteRow: { paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: 1 },
  noteMeta: { gap: 5 },
  noteHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  noteText: { flex: 1, fontSize: 14, fontWeight: '600' },
  noteAmount: { fontSize: 14, fontWeight: '700' },
  noteBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: { borderWidth: 1, borderRadius: radii.lg, padding: 16 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
});
