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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { X, Fuel, Utensils, Wrench, ShoppingBag, BookOpen, GraduationCap, CircleEllipsis, Wallet, Plus, Tag } from 'lucide-react-native';
import { saveTransaction, getRecentNotes, getCategories, addCategory, type Category, type NoteSuggestion } from '@/lib/storage';

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

interface CategoryDef {
  id: Category;
  label: string;
  icon: any;
  color: string;
  bg: string;
}

// EXPENSE_CATEGORIES is now fetched from storage

import { useTheme } from '@/lib/theme';

export default function AddTransactionScreen() {
  const router = useRouter();
  const [type, setType] = useState<TxType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [allRecentNotes, setAllRecentNotes] = useState<NoteSuggestion[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<NoteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  const noteRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const { colors, isDark } = useTheme();

  // Load recent notes and categories on mount
  useEffect(() => {
    getRecentNotes().then(setAllRecentNotes);
    getCategories().then(setCategories);
  }, []);

  // Update suggestions when note changes
  useEffect(() => {
    if (!note) {
      setFilteredNotes([]);
      setShowSuggestions(false);
      return;
    }

    const filtered = allRecentNotes.filter(s => 
      s.note.toLowerCase().includes(note.toLowerCase()) && 
      s.note.toLowerCase() !== note.toLowerCase()
    );
    setFilteredNotes(filtered.slice(0, 5));
    setShowSuggestions(filtered.length > 0);
  }, [note, allRecentNotes]);



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
    const parsed = parseFloat(amount);
    if (!parsed || isNaN(parsed)) return;
    if (type === 'expense' && !selectedCategory) return;

    setSaving(true);
    const now = new Date();
    await saveTransaction(now, {
      amount: parsed,
      date: now.toISOString(),
      note: note.trim() || undefined,
      category: type === 'expense' ? selectedCategory! : undefined,
      type,
    });
    router.replace('/(tabs)'); // Navigate to Home page as requested
  };

  const canSave = amount && parseFloat(amount) > 0 && (type === 'income' || selectedCategory);

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Transaction</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Type Toggle */}
          <View style={[styles.toggleContainer, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'expense' && styles.toggleBtnExpenseActive]}
              onPress={() => setType('expense')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, { color: colors.muted }, type === 'expense' && styles.toggleTextExpenseActive]}>
                Expense
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, type === 'income' && styles.toggleBtnIncomeActive]}
              onPress={() => setType('income')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, { color: colors.muted }, type === 'income' && styles.toggleTextIncomeActive]}>
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
                      <Plus size={16} color="#10B981" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Income icon hint */}
          {type === 'income' && (
            <View style={styles.incomeHint}>
              <View style={[styles.incomeIconBg, { backgroundColor: '#10B98115' }]}>
                <Wallet size={28} color="#10B981" />
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
              onFocus={() => setShowSuggestions(filteredNotes.length > 0)}
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                >
                  {filteredNotes.map((suggestion, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.suggestionChip, { backgroundColor: colors.card2, borderColor: colors.border }]}
                      onPress={() => {
                        setNote(suggestion.note);
                        setAmount(suggestion.amount.toString());
                        setShowSuggestions(false);
                        // Focus amount briefly then you can just save
                        amountRef.current?.focus();
                      }}
                    >
                      <Text style={[styles.suggestionText, { color: colors.subtext }]}>
                        {suggestion.note} • {suggestion.amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
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

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && [styles.saveBtnDisabled, { backgroundColor: colors.card }]]}
            onPress={handleSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
          >
            <Text style={[styles.saveBtnText, !canSave && [styles.saveBtnTextDisabled, { color: colors.muted }]]}>
              {saving ? 'Saving…' : type === 'expense' ? 'Save Expense' : 'Save Income'}
            </Text>
          </TouchableOpacity>
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
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 10,
  },
  toggleBtnExpenseActive: {
    backgroundColor: '#EF444420',
  },
  toggleBtnIncomeActive: {
    backgroundColor: '#10B98120',
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  toggleTextExpenseActive: {
    color: '#EF4444',
  },
  toggleTextIncomeActive: {
    color: '#10B981',
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
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '31.5%', // Approx 3 columns
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  categoryIconBgSmall: {
    width: 28,
    height: 28,
    borderRadius: 8,
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
    borderRadius: 12,
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
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeHintText: {
    fontSize: 14,
  },
  // Note
  noteInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  // Suggestions
  suggestionsContainer: {
    marginTop: 8,
    flexDirection: 'row',
  },
  suggestionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // Amount
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
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
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveBtnDisabled: {},
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  saveBtnTextDisabled: {},
});
