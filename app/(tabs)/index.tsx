import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  DeviceEventEmitter,
  TextInput,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  format,
  addMonths,
  subMonths,
  parseISO,
  isToday,
  isYesterday,
  isSameDay,
  isSameMonth,
  startOfWeek,
  startOfMonth,
  endOfWeek,
  endOfMonth,
  eachDayOfInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  User,
  Search,
  X,
  Banknote,
  Smartphone,
  SlidersHorizontal,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  Scale,
} from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import {
  getMonthData,
  getSummaries,
  getUserProfile,
  resolvePaidWith,
  saveTransaction,
  ensureValidTransactionId,
  getReconciliation,
  saveReconciliation,
  getCarryForward,
  saveCarryForward,
  getCurrencySymbol,
  getLastCheckPromptMonth,
  setLastCheckPromptMonth,
  type MonthData,
  type Transaction,
  type MonthReconciliation,
} from '@/lib/storage';
import { iconForCategory, colorForCategory } from '@/components/category-icon';

import { useTheme, type ThemeColors } from '@/lib/theme';
import { TRANSACTIONS_SYNCED_EVENT } from '@/lib/sync';
import { FALLBACK_PROFILE_AVATAR_URI } from '@/constants/profileDisplay';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';

type PaidFilter = 'all' | 'cash' | 'online';
type DatePickerTarget = 'from' | 'to';

function dayKey(iso: string) {
  return format(new Date(iso), 'yyyy-MM-dd');
}

function formatDayLabel(key: string) {
  const d = parseISO(key);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, d MMM');
}

function groupTransactionsByDay(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const key = dayKey(t.date);
    const list = map.get(key);
    if (list) list.push(t);
    else map.set(key, [t]);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, items]) => {
      const sorted = [...items].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      return {
        day,
        items: sorted,
        expenseTotal: sorted
          .filter((i) => i.type === 'expense')
          .reduce((sum, i) => sum + i.amount, 0),
        incomeTotal: sorted
          .filter((i) => i.type === 'income')
          .reduce((sum, i) => sum + i.amount, 0),
      };
    });
}

export default function HomeScreen() {
  const scrollRef = useScrollToTopOnFocus();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [listData, setListData] = useState<MonthData>({ income: [], expenses: [] });
  const [loading, setLoading] = useState(false);
  const isFocused = useIsFocused();
  const { colors } = useTheme();
  const [profileAvatarUri, setProfileAvatarUri] = useState(FALLBACK_PROFILE_AVATAR_URI);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [paidFilter, setPaidFilter] = useState<PaidFilter>('all');
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [datePickerTarget, setDatePickerTarget] = useState<DatePickerTarget | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Reconciliation & carry-forward state
  const [reconciliation, setReconciliation] = useState<MonthReconciliation | null>(null);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  // autoPrompt* is set when the check fires for the PREVIOUS month automatically
  const [autoPromptDate, setAutoPromptDate] = useState<Date | null>(null);
  const [autoPromptBalance, setAutoPromptBalance] = useState(0);
  const [prevMonthBalance, setPrevMonthBalance] = useState(0);
  const [prevMonthKey, setPrevMonthKey] = useState('');
  const [carryForwardDone, setCarryForwardDone] = useState(false);
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false);
  const [carryToNextMonth, setCarryToNextMonth] = useState(false); // true = current→next, false = prev→current
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const loadData = useCallback(async () => {
    setLoading(true);
    const monthData = await getMonthData(currentDate);
    setData(monthData);

    // Load currency symbol
    getCurrencySymbol().then(setCurrencySymbol);

    // Load reconciliation for current month
    const mKey = format(currentDate, 'yyyy_MM');
    const rec = await getReconciliation(mKey);
    setReconciliation(rec);

    // Carry-forward: check by looking at actual income transactions (not AsyncStorage flag)
    // This way: deleting the "Balance from X" income transaction auto-resets the banner
    const prevMonth = subMonths(currentDate, 1);
    const prevKey = format(prevMonth, 'yyyy_MM');
    const prevMonthLabel = format(prevMonth, 'MMMM yyyy');
    setPrevMonthKey(prevKey);

    const alreadyCarried = monthData.income.some(
      (t) => t.note?.startsWith('Balance from ')
    );
    setCarryForwardDone(alreadyCarried);

    if (!alreadyCarried) {
      const prevData = await getMonthData(prevMonth);
      const prevSummary = getSummaries(prevData);
      const prevClosing = prevSummary.balance; // income - cash expenses
      setPrevMonthBalance(prevClosing > 0 ? prevClosing : 0);
    } else {
      setPrevMonthBalance(0);
    }

    const rangeStart = fromDate ? parseISO(fromDate) : startOfMonth(currentDate);
    const rangeEnd = toDate ? parseISO(toDate) : endOfMonth(currentDate);
    const from = rangeStart <= rangeEnd ? rangeStart : rangeEnd;
    const to = rangeStart <= rangeEnd ? rangeEnd : rangeStart;
    const months: Date[] = [];
    let cursor = startOfMonth(from);
    const last = startOfMonth(to);
    while (cursor.getTime() <= last.getTime()) {
      months.push(cursor);
      cursor = addMonths(cursor, 1);
    }
    const coversOnlyCurrentMonth =
      months.length === 1 && format(months[0], 'yyyy_MM') === format(currentDate, 'yyyy_MM');
    if (coversOnlyCurrentMonth) {
      setListData(monthData);
    } else {
      const all = await Promise.all(months.map((m) => getMonthData(m)));
      setListData({
        income: all.flatMap((m) => m.income),
        expenses: all.flatMap((m) => m.expenses),
      });
    }
    setLoading(false);
  }, [currentDate, fromDate, toDate]);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused, loadData]);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    getUserProfile().then((p) => {
      if (cancelled) return;
      const uri = p?.avatarUri?.trim();
      setProfileAvatarUri(uri || FALLBACK_PROFILE_AVATAR_URI);
      setAvatarLoadFailed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [isFocused]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TRANSACTIONS_SYNCED_EVENT, loadData);
    return () => sub.remove();
  }, [loadData]);

  // Auto-prompt: once per month, ask the user to check their balance for the previous month
  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      const thisMonthKey = format(new Date(), 'yyyy_MM');
      const lastPrompted = await getLastCheckPromptMonth();
      if (lastPrompted === thisMonthKey) return; // already asked this month

      const prevMonth = subMonths(new Date(), 1);
      const prevKey = format(prevMonth, 'yyyy_MM');
      const prevData = await getMonthData(prevMonth);
      const hasPrevData = prevData.income.length > 0 || prevData.expenses.length > 0;
      if (!hasPrevData) return; // nothing to check

      const prevRec = await getReconciliation(prevKey);
      if (prevRec) return; // already checked by the user

      // Mark as prompted so we don't ask again this month
      await setLastCheckPromptMonth(thisMonthKey);

      const prevSummary = getSummaries(prevData);
      setAutoPromptDate(prevMonth);
      setAutoPromptBalance(prevSummary.totalExpenses);
      setShowReconcileModal(true);
    })();
  }, [isFocused]);

  const { totalIncome, totalExpenses, cashExpenses, onlineExpenses, balance } = getSummaries(data);

  // Check if next month already has a carry-forward income from this month
  const [nextMonthCarryDone, setNextMonthCarryDone] = useState(false);
  useEffect(() => {
    getMonthData(addMonths(currentDate, 1)).then((d) => {
      setNextMonthCarryDone(d.income.some((t) => t.note?.startsWith('Balance from ')));
    });
  }, [currentDate]);

  const allTransactions: Transaction[] = useMemo(
    () =>
      [
        ...listData.income.map((t) => ({ ...t, type: 'income' as const })),
        ...listData.expenses.map((t) => ({ ...t, type: 'expense' as const })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [listData]
  );

  const filteredTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTransactions.filter((t) => {
      if (paidFilter !== 'all') {
        if (t.type !== 'expense') return false;
        if (resolvePaidWith(t) !== paidFilter) return false;
      }
      const key = dayKey(t.date);
      if (fromDate && key < fromDate) return false;
      if (toDate && key > toDate) return false;
      if (q) {
        const paidWith = t.type === 'expense' ? resolvePaidWith(t) : '';
        const hay = [
          t.note,
          t.category,
          t.type,
          t.amount.toString(),
          t.amount.toFixed(2),
          paidWith,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allTransactions, paidFilter, fromDate, toDate, searchQuery]);

  const dayGroups = useMemo(
    () => groupTransactionsByDay(filteredTransactions),
    [filteredTransactions]
  );

  const hasActiveFilters =
    paidFilter !== 'all' || !!fromDate || !!toDate || searchQuery.trim().length > 0;

  const clearFilters = () => {
    setPaidFilter('all');
    setFromDate(null);
    setToDate(null);
    setSearchQuery('');
  };

  const openDatePicker = (target: DatePickerTarget) => {
    const selected = target === 'from' ? fromDate : toDate;
    setCalendarMonth(selected ? parseISO(selected) : currentDate);
    setDatePickerTarget(target);
  };

  const applyPickedDate = (day: Date) => {
    const key = format(day, 'yyyy-MM-dd');
    if (datePickerTarget === 'from') {
      setFromDate(key);
      if (toDate && key > toDate) setToDate(key);
    } else if (datePickerTarget === 'to') {
      setToDate(key);
      if (fromDate && key < fromDate) setFromDate(key);
    }
    setDatePickerTarget(null);
  };

  const selectedPickerDate =
    datePickerTarget === 'from' && fromDate
      ? parseISO(fromDate)
      : datePickerTarget === 'to' && toDate
        ? parseISO(toDate)
        : null;

  const paidFilters: { id: PaidFilter; label: string; Icon?: typeof Banknote }[] = [
    { id: 'all', label: 'All' },
    { id: 'cash', label: 'Cash', Icon: Banknote },
    { id: 'online', label: 'Online', Icon: Smartphone },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topHeader}>
          <View>
            <Text style={[styles.greeting, { color: colors.text }]}>ACO</Text>
            <Text style={[styles.subGreeting, { color: colors.muted }]}>{format(new Date(), 'EEEE, d MMMM')}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.profileBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
            onPress={() => router.push('/(tabs)/profile' as any)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Profile"
          >
            {avatarLoadFailed ? (
              <User size={22} color={colors.heading} strokeWidth={2} />
            ) : (
              <Image
                source={{ uri: profileAvatarUri }}
                style={styles.profileImage}
                contentFit="cover"
                transition={150}
                onError={() => setAvatarLoadFailed(true)}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Balance Card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.heroRow}>
            <View style={styles.heroCol}>
              <Text style={[styles.balanceLabel, { color: colors.muted }]}>Total Balance</Text>
              <Text
                style={[styles.balanceValue, { color: balance >= 0 ? colors.text : '#EF4444' }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {balance < 0 ? '-' : ''}{Math.abs(balance).toFixed(2)}
              </Text>
            </View>
            <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />
            <View style={styles.heroCol}>
              <Text style={[styles.balanceLabel, { color: colors.muted }]}>Total Expenses</Text>
              <Text
                style={[styles.balanceValue, { color: colors.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.55}
              >
                {totalExpenses.toFixed(2)}
              </Text>
            </View>
          </View>
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

          <View style={[styles.statsRow, { backgroundColor: colors.bg }]}>
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: colors.income }]} />
              <View>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Income</Text>
                <Text style={[styles.statIncome, { color: colors.income }]}>{totalIncome.toFixed(0)}</Text>
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#F59E0B' }]} />
              <View>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Cash</Text>
                <Text style={[styles.statExpense, { color: colors.text }]}>{cashExpenses.toFixed(0)}</Text>
              </View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <View style={[styles.statDot, { backgroundColor: '#0EA5E9' }]} />
              <View>
                <Text style={[styles.statLabel, { color: colors.muted }]}>Online</Text>
                <Text style={[styles.statExpense, { color: colors.text }]}>{onlineExpenses.toFixed(0)}</Text>
              </View>
            </View>
          </View>

          {/* Balance check row */}
          <View style={[styles.reconcileRow, { borderTopColor: colors.border }]}>
            {reconciliation ? (
              <View style={styles.reconciledStatus}>
                <CheckCircle2 size={13} color="#22C55E" />
                <Text style={[styles.reconciledText, { color: colors.muted }]}>
                  Matched {currencySymbol}{reconciliation.actualBalance.toFixed(0)}
                </Text>
              </View>
            ) : (
              <View style={{ width: 1 }} />
            )}
            <TouchableOpacity
              style={[styles.reconcileBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}
              onPress={() => { setAutoPromptDate(null); setShowReconcileModal(true); }}
              activeOpacity={0.8}
            >
              <Scale size={12} color={colors.muted} />
              <Text style={[styles.reconcileBtnText, { color: colors.muted }]}>
                Check balance
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Move current month balance to next month */}
        {!nextMonthCarryDone && balance > 0 && (
          <TouchableOpacity
            style={[styles.carryBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {
              setPrevMonthBalance(balance);
              setCarryToNextMonth(true);
              setShowCarryForwardModal(true);
            }}
            activeOpacity={0.8}
          >
            <ArrowRightLeft size={16} color={colors.heading} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.carryBannerTitle, { color: colors.text }]}>
                Move ₨{balance.toFixed(0)} to {format(addMonths(currentDate, 1), 'MMMM')}?
              </Text>
              <Text style={[styles.carryBannerSub, { color: colors.muted }]}>
                Tap to carry this balance to next month
              </Text>
            </View>
            <ChevronRight size={16} color={colors.muted} />
          </TouchableOpacity>
        )}

        {/* Bring money from last month banner */}
        {!carryForwardDone && prevMonthBalance > 0 && (
          <TouchableOpacity
            style={[styles.carryBanner, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => { setCarryToNextMonth(false); setShowCarryForwardModal(true); }}
            activeOpacity={0.8}
          >
            <ArrowRightLeft size={16} color={colors.heading} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.carryBannerTitle, { color: colors.text }]}>
                You had {currencySymbol}{prevMonthBalance.toFixed(0)} left in {format(subMonths(currentDate, 1), 'MMMM')}
              </Text>
              <Text style={[styles.carryBannerSub, { color: colors.muted }]}>
                Tap to add it to this month
              </Text>
            </View>
            <ChevronRight size={16} color={colors.muted} />
          </TouchableOpacity>
        )}

        {/* Transactions */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>All Transactions</Text>
          <View style={styles.sectionActions}>
            {hasActiveFilters ? (
              <TouchableOpacity onPress={clearFilters} activeOpacity={0.7} hitSlop={8}>
                <Text style={[styles.clearFilters, { color: colors.heading }]}>Clear</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.filterToggle,
                { backgroundColor: colors.card, borderColor: colors.border },
                (filtersOpen || hasActiveFilters) && {
                  backgroundColor: colors.primaryMuted,
                  borderColor: colors.primary,
                },
              ]}
              onPress={() => setFiltersOpen((open) => !open)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Filters"
            >
              <SlidersHorizontal
                size={15}
                color={filtersOpen || hasActiveFilters ? colors.heading : colors.muted}
              />
              <Text
                style={[
                  styles.filterToggleText,
                  { color: colors.subtext },
                  (filtersOpen || hasActiveFilters) && { color: colors.heading, fontWeight: '800' },
                ]}
              >
                Filter
              </Text>
              {hasActiveFilters ? (
                <View style={[styles.filterBadge, { backgroundColor: colors.heading }]}>
                  <Text style={styles.filterBadgeText}>
                    {(paidFilter !== 'all' ? 1 : 0) +
                      (fromDate ? 1 : 0) +
                      (toDate ? 1 : 0) +
                      (searchQuery.trim() ? 1 : 0)}
                  </Text>
                </View>
              ) : null}
              <ChevronDown
                size={16}
                color={filtersOpen || hasActiveFilters ? colors.heading : colors.muted}
                style={{ transform: [{ rotate: filtersOpen ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>
          </View>
        </View>

        {filtersOpen ? (
          <View style={[styles.filterDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.searchWrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Search size={16} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search note, category, amount"
                placeholderTextColor={colors.placeholder}
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoCorrect={false}
              />
              {searchQuery.length > 0 ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                  <X size={16} color={colors.muted} />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.filterRow}>
              {paidFilters.map(({ id, label, Icon }) => {
                const active = paidFilter === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.filterChip,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                      active && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                    ]}
                    onPress={() => setPaidFilter(id)}
                    activeOpacity={0.8}
                  >
                    {Icon ? <Icon size={14} color={active ? colors.heading : colors.muted} /> : null}
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: colors.subtext },
                        active && { color: colors.heading, fontWeight: '800' },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.filterRow, { marginBottom: 0 }]}>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  fromDate && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
                onPress={() => openDatePicker('from')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: fromDate ? colors.heading : colors.subtext },
                    fromDate && { fontWeight: '800' },
                  ]}
                >
                  {fromDate ? `From ${format(parseISO(fromDate), 'd MMM')}` : 'From'}
                </Text>
                {fromDate ? (
                  <TouchableOpacity
                    onPress={() => setFromDate(null)}
                    hitSlop={8}
                    accessibilityLabel="Clear from date"
                  >
                    <X size={14} color={colors.heading} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateChip,
                  { backgroundColor: colors.bg, borderColor: colors.border },
                  toDate && { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
                ]}
                onPress={() => openDatePicker('to')}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: toDate ? colors.heading : colors.subtext },
                    toDate && { fontWeight: '800' },
                  ]}
                >
                  {toDate ? `To ${format(parseISO(toDate), 'd MMM')}` : 'To'}
                </Text>
                {toDate ? (
                  <TouchableOpacity
                    onPress={() => setToDate(null)}
                    hitSlop={8}
                    accessibilityLabel="Clear to date"
                  >
                    <X size={14} color={colors.heading} />
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {!hasActiveFilters && allTransactions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No transactions this month yet.</Text>
            <Text style={[styles.emptySubText, { color: colors.placeholder }]}>Tap + to add your first one!</Text>
          </View>
        ) : dayGroups.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>No matching transactions.</Text>
            <Text style={[styles.emptySubText, { color: colors.placeholder }]}>Try a different filter or search.</Text>
          </View>
        ) : (
          dayGroups.map((group) => (
            <View key={group.day} style={styles.dayBlock}>
              <View style={styles.dayHeader}>
                <Text style={[styles.dayLabel, { color: colors.text }]}>{formatDayLabel(group.day)}</Text>
                <View style={styles.dayTotals}>
                  {group.incomeTotal > 0 ? (
                    <Text style={[styles.dayIncome, { color: colors.income }]}>
                      +{group.incomeTotal.toFixed(0)}
                    </Text>
                  ) : null}
                  {group.expenseTotal > 0 ? (
                    <Text style={[styles.dayExpense, { color: colors.expense }]}>
                      -{group.expenseTotal.toFixed(0)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={[styles.txList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {group.items.map((t, i) => {
                  const isIncome = t.type === 'income';
                  const paidWith = !isIncome ? resolvePaidWith(t) : null;
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
                  const noteText = t.note || format(new Date(t.date), 'h:mm a');
                  const subtitle = paidWith
                    ? `${paidWith === 'online' ? 'Online' : 'Cash'} · ${noteText}`
                    : noteText;

                  return (
                    <TouchableOpacity
                      key={t.id || `${t.date}-${i}`}
                      style={[
                        styles.txRow,
                        i < group.items.length - 1 && [styles.txRowBorder, { borderBottomColor: colors.border2 }],
                      ]}
                      onPress={() => {
                        if (!t.id) return;
                        router.push({
                          pathname: '/add-transaction',
                          params: { m: format(new Date(t.date), 'yyyy_MM'), id: t.id },
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.txIcon, { backgroundColor: color + '18' }]}>
                        <Icon size={18} color={color} />
                      </View>
                      <View style={styles.txMeta}>
                        <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                          {isIncome ? 'Income' : t.category}
                        </Text>
                        <Text style={[styles.txNote, { color: colors.muted }]} numberOfLines={1}>
                          {subtitle}
                        </Text>
                      </View>
                      <View style={styles.txRight}>
                        <Text style={[styles.txAmount, { color: isIncome ? colors.income : colors.expense }]}>
                          {isIncome ? '+' : '-'}{t.amount.toFixed(2)}
                        </Text>
                        <Text style={[styles.txDate, { color: colors.placeholder }]}>
                          {format(new Date(t.date), 'h:mm a')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <DatePickerModal
        visible={datePickerTarget !== null}
        colors={colors}
        calendarMonth={calendarMonth}
        selectedDate={selectedPickerDate}
        title={datePickerTarget === 'to' ? 'To date' : 'From date'}
        onChangeMonth={setCalendarMonth}
        onSelectDay={applyPickedDate}
        onClose={() => setDatePickerTarget(null)}
      />

      <ReconciliationModal
        visible={showReconcileModal}
        colors={colors}
        appBalance={autoPromptDate ? autoPromptBalance : totalExpenses}
        monthKey={autoPromptDate ? format(autoPromptDate, 'yyyy_MM') : format(currentDate, 'yyyy_MM')}
        monthLabel={autoPromptDate ? format(autoPromptDate, 'MMMM') : format(currentDate, 'MMMM')}
        currencySymbol={currencySymbol}
        existing={autoPromptDate ? null : reconciliation}
        onClose={() => {
          setShowReconcileModal(false);
          setAutoPromptDate(null);
        }}
        onSaved={(rec) => {
          if (!autoPromptDate) setReconciliation(rec);
          setAutoPromptDate(null);
          loadData();
          // Chain: if there's a positive actual balance and carry-forward not done, auto-show it
          if (rec.actualBalance > 0 && !carryForwardDone && prevMonthBalance > 0) {
            setTimeout(() => setShowCarryForwardModal(true), 350);
          }
        }}
      />

      <CarryForwardModal
        visible={showCarryForwardModal}
        colors={colors}
        amount={prevMonthBalance}
        fromMonthLabel={carryToNextMonth
          ? format(currentDate, 'MMMM yyyy')
          : format(subMonths(currentDate, 1), 'MMMM yyyy')}
        toMonthLabel={carryToNextMonth
          ? format(addMonths(currentDate, 1), 'MMMM yyyy')
          : format(currentDate, 'MMMM yyyy')}
        currencySymbol={currencySymbol}
        onClose={() => { setShowCarryForwardModal(false); setCarryToNextMonth(false); }}
        onConfirm={async () => {
          const targetMonth = carryToNextMonth ? addMonths(currentDate, 1) : currentDate;
          const targetMonthKey = format(targetMonth, 'yyyy_MM');
          const firstOfTarget = startOfMonth(targetMonth);
          const sourceLabel = carryToNextMonth
            ? format(currentDate, 'MMMM yyyy')
            : format(subMonths(currentDate, 1), 'MMMM yyyy');
          const carryTx: Transaction = {
            type: 'income',
            amount: prevMonthBalance,
            date: firstOfTarget.toISOString(),
            note: `Balance from ${sourceLabel}`,
          };
          await saveTransaction(firstOfTarget, ensureValidTransactionId(carryTx));
          if (carryToNextMonth) {
            setNextMonthCarryDone(true);
          } else {
            setCarryForwardDone(true);
          }
          setPrevMonthBalance(0);
          setCarryToNextMonth(false);
          setShowCarryForwardModal(false);
          loadData();
        }}
      />
    </SafeAreaView>
  );
}

// ─── Reconciliation Modal ────────────────────────────────────────────────────

function ReconciliationModal({
  visible,
  colors,
  appBalance,
  monthKey,
  monthLabel,
  currencySymbol,
  existing,
  onClose,
  onSaved,
}: {
  visible: boolean;
  colors: ThemeColors;
  appBalance: number;
  monthKey: string;
  monthLabel: string;
  currencySymbol: string;
  existing: MonthReconciliation | null;
  onClose: () => void;
  onSaved: (rec: MonthReconciliation) => void;
}) {
  const [actualInput, setActualInput] = useState('');
  const [createAdjustment, setCreateAdjustment] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setActualInput(existing ? existing.actualBalance.toString() : '');
      setCreateAdjustment(true);
    }
  }, [visible, existing]);

  const actualNum = parseFloat(actualInput.replace(',', '.')) || 0;
  // Bank expenses > app expenses = missed expense; bank < app = over-recorded
  const difference = actualNum - appBalance;
  const hasInput = actualInput.trim() !== '' && !isNaN(parseFloat(actualInput));
  const hasDiff = hasInput && Math.abs(difference) >= 0.01;
  const missedExpenses = hasDiff && difference > 0;  // bank spent more than app recorded
  const overRecorded = hasDiff && difference < 0;    // app recorded more than bank shows

  const handleSave = async () => {
    if (!hasInput) return;
    setSaving(true);
    try {
      const rec: MonthReconciliation = {
        monthKey,
        appBalance,
        actualBalance: actualNum,
        difference,
        reconciledAt: new Date().toISOString(),
        adjustmentCreated: false,
      };

      if (hasDiff && createAdjustment) {
        // Put the adjustment on the last day of the reconciled month (not today)
        const [y, mo] = monthKey.split('_').map(Number);
        const adjDate = endOfMonth(new Date(y, mo - 1, 1));
        const tx: Transaction = missedExpenses
          ? {
              type: 'expense',
              amount: Math.abs(difference),
              date: adjDate.toISOString(),
              note: 'Missed expense',
              category: 'Other',
              paidWith: 'cash',
            }
          : {
              type: 'expense',
              amount: Math.abs(difference),
              date: adjDate.toISOString(),
              note: 'Over-recorded adjustment',
              category: 'Other',
              paidWith: 'cash',
            };
        await saveTransaction(adjDate, ensureValidTransactionId(tx));
        rec.adjustmentCreated = true;
      }

      await saveReconciliation(rec);
      onSaved(rec);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalHeading, { color: colors.text }]}>{monthLabel}</Text>
          <Text style={[styles.modalSub, { color: colors.muted }]}>
            Enter total expenses from your bank or actual source.
          </Text>

          {/* App tracked expenses row */}
          <View style={[styles.recRow, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.recRowLabel, { color: colors.muted }]}>App recorded expenses</Text>
            <Text style={[styles.recRowValue, { color: colors.text }]}>
              {currencySymbol}{appBalance.toFixed(2)}
            </Text>
          </View>

          {/* Actual expenses input */}
          <View style={[styles.recInputWrap, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.recRowLabel, { color: colors.muted }]}>Bank / actual total spent</Text>
            <View style={styles.recInputRow}>
              <Text style={[styles.recCurrency, { color: colors.subtext }]}>{currencySymbol}</Text>
              <TextInput
                style={[styles.recInput, { color: colors.text }]}
                value={actualInput}
                onChangeText={setActualInput}
                placeholder="0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                returnKeyType="done"
                autoFocus
              />
            </View>
          </View>

          {/* No difference — perfect match */}
          {hasInput && !hasDiff && (
            <View style={[styles.diffBox, { backgroundColor: '#22C55E18', borderColor: '#22C55E' }]}>
              <CheckCircle2 size={14} color="#22C55E" style={{ marginTop: 1 }} />
              <Text style={[styles.diffAmount, { color: '#22C55E', flex: 1 }]}>
                All good — everything matches!
              </Text>
            </View>
          )}

          {/* Gap found */}
          {hasDiff && (
            <View
              style={[
                styles.diffBox,
                {
                  backgroundColor: missedExpenses ? '#EF444418' : '#22C55E18',
                  borderColor: missedExpenses ? '#EF4444' : '#22C55E',
                },
              ]}
            >
              <AlertTriangle
                size={14}
                color={missedExpenses ? '#EF4444' : '#22C55E'}
                style={{ marginTop: 1 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.diffAmount, { color: missedExpenses ? '#EF4444' : '#22C55E' }]}>
                  {missedExpenses
                    ? `₨${Math.abs(difference).toFixed(2)} in missed expenses`
                    : `₨${Math.abs(difference).toFixed(2)} extra recorded in app`}
                </Text>
                <Text style={[styles.diffDesc, { color: colors.muted }]}>
                  {missedExpenses
                    ? 'Bank shows more spending than app — some expenses were not logged.'
                    : 'App shows more expenses than bank — may have a duplicate entry.'}
                </Text>
              </View>
            </View>
          )}

          {/* Auto-fix checkbox */}
          {hasDiff && (
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setCreateAdjustment((v) => !v)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: createAdjustment ? colors.primary : colors.bg,
                    borderColor: createAdjustment ? colors.primary : colors.border,
                  },
                ]}
              >
                {createAdjustment && <CheckCircle2 size={14} color="#FFF" />}
              </View>
              <Text style={[styles.checkLabel, { color: colors.subtext }]}>
                {missedExpenses
                  ? `Add ${currencySymbol}${Math.abs(difference).toFixed(2)} as missed expense in ${monthLabel}`
                  : `Remove ${currencySymbol}${Math.abs(difference).toFixed(2)} as over-recorded in ${monthLabel}`}
              </Text>
            </TouchableOpacity>
          )}

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.modalBtn,
              { backgroundColor: hasInput ? colors.heading : colors.card2 },
            ]}
            onPress={handleSave}
            disabled={!hasInput || saving}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalBtnText, { color: hasInput ? '#FFF' : colors.muted }]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={[styles.modalCancelText, { color: colors.muted }]}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Carry Forward Modal ─────────────────────────────────────────────────────

function CarryForwardModal({
  visible,
  colors,
  amount,
  fromMonthLabel,
  toMonthLabel,
  currencySymbol,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  colors: ThemeColors;
  amount: number;
  fromMonthLabel: string;
  toMonthLabel: string;
  currencySymbol: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.carryIconWrap, { backgroundColor: colors.primaryMuted }]}>
            <ArrowRightLeft size={24} color={colors.heading} />
          </View>
          <Text style={[styles.modalHeading, { color: colors.text }]}>
            Add last month's savings? 💰
          </Text>
          <Text style={[styles.modalSub, { color: colors.muted }]}>
            You had money left over in {fromMonthLabel}. Want to start {toMonthLabel} with it?
          </Text>

          <View style={[styles.carryAmountBox, { backgroundColor: colors.bg, borderColor: colors.border }]}>
            <Text style={[styles.carryAmountLabel, { color: colors.muted }]}>Left over from {fromMonthLabel}</Text>
            <Text style={[styles.carryAmountValue, { color: colors.income }]}>
              +{currencySymbol}{amount.toFixed(2)}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.modalBtn, { backgroundColor: colors.heading }]}
            onPress={handleConfirm}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.modalBtnText, { color: '#FFF' }]}>
              {loading ? 'Adding…' : `Yes, add ${currencySymbol}${amount.toFixed(0)} to ${toMonthLabel}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalCancelBtn, { marginTop: 4 }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={[styles.modalCancelText, { color: colors.muted }]}>No thanks, start fresh</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Date Picker Modal ───────────────────────────────────────────────────────

function DatePickerModal({
  visible,
  colors,
  calendarMonth,
  selectedDate,
  title,
  onChangeMonth,
  onSelectDay,
  onClose,
}: {
  visible: boolean;
  colors: ThemeColors;
  calendarMonth: Date;
  selectedDate: Date | null;
  title: string;
  onChangeMonth: (updater: (month: Date) => Date) => void;
  onSelectDay: (day: Date) => void;
  onClose: () => void;
}) {
  const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.dateModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.dateModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.dateModalHeading, { color: colors.text }]}>{title}</Text>
          <View style={styles.dateModalHeader}>
            <TouchableOpacity
              onPress={() => onChangeMonth((m) => addMonths(m, -1))}
              style={[styles.dateModalChevron, { backgroundColor: colors.card2 }]}
            >
              <ChevronLeft size={20} color={colors.subtext} />
            </TouchableOpacity>
            <Text style={[styles.dateModalTitle, { color: colors.text }]}>
              {format(calendarMonth, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity
              onPress={() => onChangeMonth((m) => addMonths(m, 1))}
              style={[styles.dateModalChevron, { backgroundColor: colors.card2 }]}
            >
              <ChevronRight size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
              <Text key={idx} style={[styles.weekdayCell, { color: colors.placeholder }]}>
                {d}
              </Text>
            ))}
          </View>
          {rows.map((week, wi) => (
            <View key={wi} style={styles.calendarWeek}>
              {week.map((day, di) => {
                const inMonth = isSameMonth(day, calendarMonth);
                const selected = selectedDate ? isSameDay(day, selectedDate) : false;
                return (
                  <TouchableOpacity
                    key={di}
                    style={[
                      styles.dayCell,
                      selected && { backgroundColor: colors.primaryMuted },
                    ]}
                    onPress={() => onSelectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayCellText,
                        { color: colors.text },
                        !inMonth && { color: colors.placeholder, opacity: 0.35 },
                        selected && { color: colors.heading, fontWeight: '800' },
                      ]}
                    >
                      {format(day, 'd')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
          <TouchableOpacity style={[styles.dateModalClose, { backgroundColor: colors.card2 }]} onPress={onClose}>
            <Text style={[styles.dateModalCloseText, { color: colors.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 20 },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
  },
  greeting: { fontSize: 22, fontWeight: '800' },
  subGreeting: { fontSize: 13, marginTop: 2 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 22,
  },
  balanceCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    gap: 8,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  heroCol: {
    flex: 1,
    minWidth: 0,
  },
  heroDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginHorizontal: 14,
    marginVertical: 2,
  },
  balanceLabel: { fontSize: 13, fontWeight: '500' },
  balanceValue: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 2 },
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
  statItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { fontSize: 11 },
  statIncome: { fontSize: 15, fontWeight: '700' },
  statExpense: { fontSize: 15, fontWeight: '700' },
  statDivider: { width: 1, height: 32, marginHorizontal: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearFilters: { fontSize: 13, fontWeight: '700' },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterToggleText: { fontSize: 13, fontWeight: '600' },
  filterBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  filterDropdown: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  dateChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },
  emptyCard: {
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 6,
  },
  emptyText: { fontSize: 14 },
  emptySubText: { fontSize: 12 },
  dayBlock: {
    marginTop: 6,
    marginBottom: 10,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  dayLabel: { fontSize: 13, fontWeight: '700' },
  dayTotals: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayIncome: { fontSize: 13, fontWeight: '700' },
  dayExpense: { fontSize: 13, fontWeight: '700' },
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
  dateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dateModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    zIndex: 1,
  },
  dateModalHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateModalChevron: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateModalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarWeek: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateModalClose: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  dateModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Reconcile row (inside balance card) ──
  reconcileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginTop: 6,
    borderTopWidth: 1,
  },
  reconciledStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  reconciledText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reconcileHint: {
    fontSize: 12,
  },
  reconcileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  reconcileBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },

  // ── Carry Forward Banner ──
  carryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  carryBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  carryBannerSub: {
    fontSize: 12,
    marginTop: 1,
  },

  // ── Shared Modal Styles ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 14,
  },
  modalHeading: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // ── Reconciliation Modal Specifics ──
  recRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  recRowLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  recRowValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  recInputWrap: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  recInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recCurrency: {
    fontSize: 18,
    fontWeight: '600',
  },
  recInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 2,
  },
  diffBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  diffAmount: {
    fontSize: 14,
    fontWeight: '700',
  },
  diffDesc: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },

  // ── Carry Forward Modal Specifics ──
  carryIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  carryAmountBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  carryAmountLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  carryAmountValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  carryAmountFrom: {
    fontSize: 12,
  },
});
