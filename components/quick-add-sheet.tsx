import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Pressable,
  DeviceEventEmitter,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Check, Delete } from 'lucide-react-native';
import {
  Fuel,
  Utensils,
  Wrench,
  ShoppingBag,
  BookOpen,
  GraduationCap,
  CircleEllipsis,
  Tag,
} from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { getCategories, saveTransaction } from '@/lib/storage';
import { chartGradients, radii } from '@/constants/designTokens';
import { Fonts } from '@/constants/fonts';

/** Emitted after a quick-add save so home screen can refresh. */
export const QUICK_ADD_SAVED_EVENT = 'quick_add_saved';

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

interface QuickAddSheetProps {
  visible: boolean;
  onClose: () => void;
}

const NUMPAD_ROWS = [
  ['7', '8', '9'],
  ['4', '5', '6'],
  ['1', '2', '3'],
  ['.', '0', '⌫'],
];

export function QuickAddSheet({ visible, onClose }: QuickAddSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset state every time sheet opens
  useEffect(() => {
    if (visible) {
      getCategories().then(setCategories);
      setAmount('');
      setSelectedCategory(null);
      setType('expense');
    }
  }, [visible]);

  // Clear category when switching to income
  useEffect(() => {
    if (type === 'income') setSelectedCategory(null);
  }, [type]);

  const handleNumpad = useCallback((key: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount((prev) => {
      if (key === '⌫') return prev.slice(0, -1);
      if (key === '.' && prev.includes('.')) return prev;
      if (key === '.' && prev === '') return '0.';
      if (prev === '0' && key !== '.') return key;
      // Limit to 2 decimal places
      if (prev.includes('.')) {
        const [, dec] = prev.split('.');
        if (dec && dec.length >= 2) return prev;
      }
      if (prev.replace('.', '').length >= 9) return prev;
      return prev + key;
    });
  }, []);

  const canSave =
    !!amount &&
    parseFloat(amount) > 0 &&
    (type === 'income' || !!selectedCategory);

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const now = new Date();
      await saveTransaction(now, {
        amount: parseFloat(amount),
        date: now.toISOString(),
        category: type === 'expense' ? (selectedCategory as any) : undefined,
        type,
        paidWith: type === 'expense' ? 'cash' : undefined,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      DeviceEventEmitter.emit(QUICK_ADD_SAVED_EVENT);
      onClose();
    } catch (e) {
      console.warn('[QuickAdd] save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const amountDisplay = amount || '0';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dimmed backdrop -- tap to dismiss */}
      <Pressable style={styles.overlay} onPress={onClose} />

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
      >
        {/* Drag handle */}
        <View style={styles.handleWrap}>
          <View style={[styles.handle, { backgroundColor: colors.border2 }]} />
        </View>

        {/* Header row: type toggle + close */}
        <View style={styles.headerRow}>
          <View style={[styles.typeToggle, { backgroundColor: colors.card2 }]}>
            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'expense' && {
                  backgroundColor: colors.expenseMuted,
                },
              ]}
              onPress={() => setType('expense')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  {
                    fontFamily: Fonts.bold,
                    color:
                      type === 'expense' ? colors.expense : colors.muted,
                  },
                ]}
              >
                Expense
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.typeBtn,
                type === 'income' && {
                  backgroundColor: colors.primaryMuted,
                },
              ]}
              onPress={() => setType('income')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.typeBtnText,
                  {
                    fontFamily: Fonts.bold,
                    color:
                      type === 'income' ? colors.income : colors.muted,
                  },
                ]}
              >
                Income
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.card2 }]}
            activeOpacity={0.75}
          >
            <X size={18} color={colors.subtext} />
          </TouchableOpacity>
        </View>

        {/* Amount display */}
        <View style={styles.amountWrap}>
          <Text
            style={[
              styles.amountText,
              {
                fontFamily: Fonts.extrabold,
                color: amount ? colors.text : colors.placeholder,
              },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {amountDisplay}
          </Text>
        </View>

        {/* Category chips (expense only) */}
        {type === 'expense' && categories.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
            style={styles.catScroll}
          >
            {categories.map((cat) => {
              const IconComp = ICON_MAP[cat.icon] || Tag;
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: colors.bg,
                      borderColor: isSelected ? cat.color : colors.border,
                    },
                    isSelected && {
                      backgroundColor: cat.color + '22',
                    },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(isSelected ? null : cat.id);
                  }}
                  activeOpacity={0.75}
                >
                  <IconComp
                    size={14}
                    color={isSelected ? cat.color : colors.subtext}
                  />
                  <Text
                    style={[
                      styles.catChipText,
                      {
                        fontFamily: Fonts.semibold,
                        color: isSelected ? cat.color : colors.subtext,
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Numpad */}
        <View style={styles.numpad}>
          {NUMPAD_ROWS.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.numKey, { backgroundColor: colors.card2 }]}
                  onPress={() => handleNumpad(key)}
                  activeOpacity={0.55}
                >
                  {key === '⌫' ? (
                    <Delete size={22} color={colors.subtext} />
                  ) : (
                    <Text
                      style={[
                        styles.numKeyText,
                        {
                          fontFamily: Fonts.semibold,
                          color: colors.text,
                        },
                      ]}
                    >
                      {key}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveOuter, !canSave && styles.saveDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={canSave ? [...chartGradients.fab] : ['#555', '#444']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            <Check size={20} color={canSave ? '#163843' : '#999'} strokeWidth={2.8} />
            <Text
              style={[
                styles.saveBtnText,
                {
                  fontFamily: Fonts.extrabold,
                  color: canSave ? '#163843' : '#999',
                },
              ]}
            >
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 20,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    marginTop: 8,
  },
  typeToggle: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radii.pill,
    padding: 3,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  typeBtnText: {
    fontSize: 14,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amountWrap: {
    alignItems: 'center',
    paddingVertical: 10,
    minHeight: 80,
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 60,
    letterSpacing: -2,
  },
  catScroll: {
    marginBottom: 12,
  },
  catRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1.5,
  },
  catChipText: {
    fontSize: 13,
  },
  numpad: {
    gap: 8,
    marginBottom: 14,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 8,
  },
  numKey: {
    flex: 1,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyText: {
    fontSize: 24,
  },
  saveOuter: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  saveDisabled: {
    opacity: 0.35,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  saveBtnText: {
    fontSize: 17,
  },
});
