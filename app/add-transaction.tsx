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
import { X, Fuel, Utensils, Wrench, ShoppingBag, BookOpen, GraduationCap, CircleEllipsis, Wallet } from 'lucide-react-native';
import { saveTransaction, type Category } from '@/lib/storage';

type TxType = 'expense' | 'income';

interface CategoryDef {
  id: Category;
  label: string;
  icon: any;
  color: string;
  bg: string;
}

const EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'Petrol', label: 'Petrol', icon: Fuel, color: '#3B82F6', bg: '#EFF6FF' },
  { id: 'Food', label: 'Food', icon: Utensils, color: '#F59E0B', bg: '#FFFBEB' },
  { id: 'Repair', label: 'Repair', icon: Wrench, color: '#6366F1', bg: '#EEF2FF' },
  { id: 'Shopping', label: 'Shopping', icon: ShoppingBag, color: '#EC4899', bg: '#FDF2F8' },
  { id: 'Course', label: 'Course', icon: BookOpen, color: '#8B5CF6', bg: '#F5F3FF' },
  { id: 'Education', label: 'Education', icon: GraduationCap, color: '#10B981', bg: '#ECFDF5' },
  { id: 'Other', label: 'Other', icon: CircleEllipsis, color: '#6B7280', bg: '#F9FAFB' },
];

import { useTheme } from '@/lib/theme';

export default function AddTransactionScreen() {
  const router = useRouter();
  const [type, setType] = useState<TxType>('expense');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const noteRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);
  const { colors, isDark } = useTheme();



  // When type changes to income, clear category
  useEffect(() => {
    if (type === 'income') setSelectedCategory(null);
  }, [type]);

  const handleCategorySelect = (cat: CategoryDef) => {
    setSelectedCategory(cat.id);
    // Auto-open keyboard on the note field
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

          {/* Category Icons (only for expense) */}
          {type === 'expense' && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.muted }]}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {EXPENSE_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  const IconComp = cat.icon;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryItem,
                        { backgroundColor: colors.card },
                        isSelected && { borderColor: cat.color, borderWidth: 2 },
                      ]}
                      onPress={() => handleCategorySelect(cat)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.categoryIconBg, { backgroundColor: isSelected ? cat.color + '20' : colors.card2 }]}>
                        <IconComp size={22} color={isSelected ? cat.color : colors.subtext} />
                      </View>
                      <Text style={[styles.categoryLabel, { color: colors.subtext }, isSelected && { color: cat.color }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
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
              returnKeyType="next"
              onSubmitEditing={() => amountRef.current?.focus()}
            />
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
  // Categories
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 4,
  },
  categoryItem: {
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    padding: 12,
    minWidth: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categoryIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
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
