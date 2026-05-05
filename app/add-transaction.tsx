import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  format,
  parse,
  parseISO,
  setHours,
  setMinutes,
  setSeconds,
  setMilliseconds,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
} from 'date-fns';
import {
  X,
  Fuel,
  Utensils,
  Wrench,
  ShoppingBag,
  BookOpen,
  GraduationCap,
  CircleEllipsis,
  Wallet,
  Plus,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import {
  saveTransaction,
  updateTransaction,
  deleteTransaction,
  getRecentNotes,
  getCategories,
  getMonthData,
  addCategory,
  type Category,
  type NoteSuggestion,
  type Transaction,
} from '@/lib/storage';
import { useTheme } from '@/lib/theme';
import { radii } from '@/constants/designTokens';
import { useScrollToTopOnFocus } from '@/hooks/use-scroll-to-top-on-focus';

const ICON_MAP: Record<string, any> = {
  Fuel,
  Utensils,
  Wrench,
  ShoppingBag,
  BookOpen,
  GraduationCap,
  CircleEllipsis,
  Tag,
};

type TxType = 'expense' | 'income';

function applyTimeFrom(isoSource: string, calendarDate: Date): Date {
  const src = parseISO(isoSource);
  let result = new Date(calendarDate);
  result = setHours(result, src.getHours());
  result = setMinutes(result, src.getMinutes());
  result = setSeconds(result, src.getSeconds());
  result = setMilliseconds(result, src.getMilliseconds());
  return result;
}

export default function AddTransactionScreen() {
  const scrollRef = useScrollToTopOnFocus();
  const router = useRouter();
  const params = useLocalSearchParams<{ m?: string | string[]; id?: string | string[] }>();
  const monthParam = typeof params.m === 'string' ? params.m : Array.isArray(params.m) ? params.m[0] : undefined;
  const idParam = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const isEditMode = !!(monthParam && idParam);

  const [type, setType] = useState<TxType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [txDate, setTxDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [originalTx, setOriginalTx] = useState<Transaction | null>(null);
  const [editLoadFailed, setEditLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allRecentNotes, setAllRecentNotes] = useState<NoteSuggestion[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isNoteFocused, setIsNoteFocused] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const noteRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const { colors } = useTheme();

  useEffect(() => {
    getRecentNotes().then(setAllRecentNotes);
    getCategories().then(setCategories);
  }, []);

  useEffect(() => {
    if (!isEditMode || !monthParam || !idParam) return;
    let cancelled = false;
    (async () => {
      const monthDate = parse(monthParam, 'yyyy_MM', new Date());
      const monthData = await getMonthData(monthDate);
      const found = [...monthData.income, ...monthData.expenses].find((t) => t.id === idParam);
      if (cancelled) return;
      if (!found) {
        setEditLoadFailed(true);
        return;
      }
      setOriginalTx(found);
      setType(found.type);
      setSelectedCategory(found.category ?? null);
      setNote(found.note ?? '');
      setAmount(String(found.amount));
      setTxDate(parseISO(found.date));
    })();
    return () => {
      cancelled = true;
    };
  }, [isEditMode, monthParam, idParam]);

  const formatSuggestionAmount = (value: number) => {
    if (Number.isInteger(value)) return `${value}`;
    return value.toFixed(2);
  };

  // Update suggestions when note/category/type changes
  useEffect(() => {
    const query = note.trim().toLowerCase();
    const scopedByCategory = allRecentNotes.filter((s) => {
      if (type !== 'expense') return true;
      if (!selectedCategory) return false;
      return s.category === selectedCategory;
    });

    let filtered = scopedByCategory;
    if (query) {
      const tokens = query.split(/\s+/).filter(Boolean);
      filtered = scopedByCategory.filter((s) => {
        const candidate = s.note.toLowerCase();
        return candidate !== query && tokens.every((token) => candidate.includes(token));
      });
    }

    setFilteredNotes(filtered.slice(0, 5));
  }, [note, allRecentNotes, selectedCategory, type]);

  useEffect(() => {
    const shouldShowCategoryHistory =
      type === 'expense' &&
      !!selectedCategory &&
      note.trim().length === 0;
    setShowSuggestions((isNoteFocused || shouldShowCategoryHistory) && filteredNotes.length > 0);
  }, [filteredNotes, isNoteFocused, note, selectedCategory, type]);



  // When type changes to income, clear category
  useEffect(() => {
    if (type === 'income') setSelectedCategory(null);
  }, [type]);

  const handleCategorySelect = (catId: string) => {
    setSelectedCategory(catId);
    // Auto-open keyboard on the note field
    setTimeout(() => noteRef.current?.focus(), 50);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    const newCat = await addCategory(newCatName.trim());
    if (newCat) {
      setCategories([...categories, newCat]);
      setSelectedCategory(newCat.id);
    }
    setNewCatName('');
    setIsAddingCategory(false);
    setTimeout(() => noteRef.current?.focus(), 50);
  };

  const handleAmountChange = (val: string) => {
    setAmount(val);
  };

  const handleSave = async () => {
    if (saving) return;
    if (isEditMode && !originalTx) return;
    const parsed = parseFloat(amount);
    if (!parsed || isNaN(parsed)) return;
    if (type === 'expense' && !selectedCategory) return;

    setSaving(true);
    try {
      const isoDate =
        isEditMode && originalTx
          ? applyTimeFrom(originalTx.date, txDate).toISOString()
          : applyTimeFrom(new Date().toISOString(), txDate).toISOString();

      if (isEditMode && originalTx) {
        await updateTransaction(originalTx, {
          ...originalTx,
          amount: parsed,
          date: isoDate,
          note: note.trim() || undefined,
          category: type === 'expense' ? selectedCategory! : undefined,
          type,
        });
      } else {
        await saveTransaction(parseISO(isoDate), {
          amount: parsed,
          date: isoDate,
          note: note.trim() || undefined,
          category: type === 'expense' ? selectedCategory! : undefined,
          type,
        });
      }
      router.replace('/(tabs)');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!originalTx) return;
    Alert.alert('Delete transaction', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTransaction(originalTx);
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  const canSave =
    amount &&
    parseFloat(amount) > 0 &&
    (type === 'income' || selectedCategory) &&
    (!isEditMode || originalTx);

  if (isEditMode && editLoadFailed) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.card2 }]}>
            <X size={20} color={colors.subtext} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Transaction</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={{ padding: 24 }}>
          <Text style={{ color: colors.muted, fontSize: 15 }}>
            This transaction could not be found. It may have been deleted or moved.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.card2 }]}>
            <X size={20} color={colors.subtext} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Toggle */}
          <View style={[styles.toggleContainer, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                type === 'expense' && { backgroundColor: colors.expenseMuted },
              ]}
              onPress={() => setType('expense')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: colors.muted },
                  type === 'expense' && { color: colors.expense, fontWeight: '800' },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                type === 'income' && { backgroundColor: colors.primaryMuted },
              ]}
              onPress={() => setType('income')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: colors.muted },
                  type === 'income' && { color: colors.income, fontWeight: '800' },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          {/* Category Grid (only for expense) */}
          {type === 'expense' && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>Category</Text>
              
              <View style={styles.categoryGrid}>
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const IconComp = ICON_MAP[cat.icon] || Tag;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryItemSmall,
                        { backgroundColor: colors.card },
                        isSelected && { borderColor: cat.color, borderWidth: 1.5 },
                      ]}
                      onPress={() => handleCategorySelect(cat.id)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.categoryIconBgSmall, { backgroundColor: isSelected ? cat.color + '15' : colors.card2 }]}>
                        <IconComp size={16} color={isSelected ? cat.color : colors.subtext} />
                      </View>
                      <Text 
                        style={[styles.categoryLabelSmall, { color: colors.subtext }, isSelected && { color: cat.color, fontWeight: '700' }]}
                        numberOfLines={1}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                
                {/* Add Category Button */}
                {!isAddingCategory ? (
                  <TouchableOpacity
                    style={[styles.categoryItemSmall, { backgroundColor: colors.card, borderStyle: 'dashed', borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => setIsAddingCategory(true)}
                  >
                    <View style={[styles.categoryIconBgSmall, { backgroundColor: colors.card2 }]}>
                      <Plus size={16} color={colors.subtext} />
                    </View>
                    <Text style={[styles.categoryLabelSmall, { color: colors.subtext }]}>Add New</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.newCatInputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      autoFocus
                      style={[styles.newCatInput, { color: colors.text }]}
                      placeholder="Name..."
                      placeholderTextColor={colors.placeholder}
                      value={newCatName}
                      onChangeText={setNewCatName}
                      onSubmitEditing={handleAddCategory}
                      returnKeyType="done"
                    />
                    <TouchableOpacity onPress={handleAddCategory} style={styles.newCatAddBtn}>
                      <Plus size={16} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Income icon hint */}
          {type === 'income' && (
            <View style={styles.incomeHint}>
              <View style={[styles.incomeIconBg, { backgroundColor: colors.primaryMuted }]}>
                <Wallet size={28} color={colors.income} />
              </View>
              <Text style={[styles.incomeHintText, { color: colors.muted }]}>Add your income amount below</Text>
            </View>
          )}

          {/* Note */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Note (optional)</Text>
            <TextInput
              ref={noteRef}
              style={[styles.noteInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
              placeholder={type === 'expense' ? 'e.g. Filled up tank' : 'e.g. Monthly salary'}
              placeholderTextColor={colors.placeholder}
              value={note}
              onChangeText={setNote}
              onFocus={() => setIsNoteFocused(true)}
              onBlur={() => setIsNoteFocused(false)}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                <Text style={[styles.suggestionTitle, { color: colors.muted }]}>
                  {type === 'expense' && selectedCategory ? 'Recent in this category' : 'Suggested notes'}
                </Text>
                <View style={styles.suggestionBadgeWrap}>
                  {filteredNotes.map((suggestion, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.suggestionChip, { backgroundColor: colors.card2, borderColor: colors.border }]}
                      onPress={() => {
                        setNote(suggestion.note);
                        setAmount(String(suggestion.amount));
                        setShowSuggestions(false);
                        setTimeout(() => amountRef.current?.focus(), 50);
                      }}
                    >
                      <Text style={[styles.suggestionText, { color: colors.subtext }]}>
                        {`${suggestion.note}: ${formatSuggestionAmount(suggestion.amount)}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>

          {/* Amount */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Amount</Text>
            <View style={[styles.amountRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                ref={amountRef}
                style={[styles.amountInput, { color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType="numeric"
                value={amount}
                onChangeText={handleAmountChange}
                returnKeyType="done"
                onSubmitEditing={canSave ? handleSave : undefined}
              />
            </View>
          </View>

          {/* Date */}
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>Date</Text>
            <TouchableOpacity
              style={[styles.noteInput, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                setCalendarMonth(startOfMonth(txDate));
                setShowDatePicker(true);
              }}
              activeOpacity={0.75}
            >
              <Text style={{ color: colors.text, fontSize: 15 }}>{format(txDate, 'EEEE, MMM d, yyyy')}</Text>
            </TouchableOpacity>
            <Modal visible={showDatePicker} transparent animationType="fade">
              <View style={styles.dateModalOverlay}>
                <TouchableOpacity
                  style={StyleSheet.absoluteFillObject}
                  activeOpacity={1}
                  onPress={() => setShowDatePicker(false)}
                />
                <View style={[styles.dateModalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.dateModalHeader}>
                      <TouchableOpacity
                        onPress={() => setCalendarMonth((m) => addMonths(m, -1))}
                        style={[styles.dateModalChevron, { backgroundColor: colors.card2 }]}
                      >
                        <ChevronLeft size={20} color={colors.subtext} />
                      </TouchableOpacity>
                      <Text style={[styles.dateModalTitle, { color: colors.text }]}>
                        {format(calendarMonth, 'MMMM yyyy')}
                      </Text>
                      <TouchableOpacity
                        onPress={() => setCalendarMonth((m) => addMonths(m, 1))}
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
                    {(() => {
                      const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
                      const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
                      const days = eachDayOfInterval({ start, end });
                      const rows: Date[][] = [];
                      for (let i = 0; i < days.length; i += 7) {
                        rows.push(days.slice(i, i + 7));
                      }
                      const timeSource =
                        isEditMode && originalTx ? originalTx.date : new Date().toISOString();
                      return rows.map((week, wi) => (
                        <View key={wi} style={styles.calendarWeek}>
                          {week.map((day, di) => {
                            const inMonth = isSameMonth(day, calendarMonth);
                            const selected = isSameDay(day, txDate);
                            return (
                              <TouchableOpacity
                                key={di}
                                style={[
                                  styles.dayCell,
                                  selected && styles.dayCellSelected,
                                  selected && { backgroundColor: colors.primaryMuted },
                                ]}
                                onPress={() => {
                                  setTxDate(applyTimeFrom(timeSource, day));
                                  setShowDatePicker(false);
                                }}
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
                      ));
                    })()}
                    <TouchableOpacity
                      style={[styles.dateModalClose, { backgroundColor: colors.card2 }]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={[styles.dateModalCloseText, { color: colors.subtext }]}>Cancel</Text>
                    </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>

          {/* Save button */}
          <TouchableOpacity
            style={[
              styles.saveBtn,
              canSave && { backgroundColor: colors.primary },
              !canSave && [styles.saveBtnDisabled, { backgroundColor: colors.card }],
            ]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.saveBtnText,
                canSave && { color: colors.primaryForeground },
                !canSave && [styles.saveBtnTextDisabled, { color: colors.muted }],
              ]}
            >
              {saving
                ? 'Saving…'
                : isEditMode
                  ? 'Save changes'
                  : type === 'expense'
                    ? 'Save Expense'
                    : 'Save Income'}
            </Text>
          </TouchableOpacity>

          {isEditMode && originalTx ? (
            <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} activeOpacity={0.85}>
              <Text style={styles.deleteBtnText}>Delete transaction</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  // Type Toggle
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // Section
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Categories Grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryItemSmall: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: radii.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '31.5%', // Approx 3 columns
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryIconBgSmall: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabelSmall: {
    fontSize: 12,
    flex: 1,
  },
  newCatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    paddingHorizontal: 10,
    width: '65%',
    height: 44,
    borderWidth: 1,
  },
  newCatInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
  },
  newCatAddBtn: {
    padding: 4,
  },
  // Income hint
  incomeHint: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 10,
  },
  incomeIconBg: {
    width: 64,
    height: 64,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeHintText: {
    fontSize: 14,
  },
  // Note
  noteInput: {
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  // Suggestions
  suggestionsContainer: {
    marginTop: 8,
    gap: 8,
  },
  suggestionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  suggestionBadgeWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: '800',
  },
  // Save button
  saveBtn: {
    borderRadius: radii.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: {},
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveBtnTextDisabled: {},
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
  dateModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dateModalChevron: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
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
    borderRadius: radii.sm,
  },
  dayCellSelected: {
    borderRadius: radii.sm,
  },
  dayCellText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dateModalClose: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  dateModalCloseText: {
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EF444460',
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#EF4444',
  },
});
