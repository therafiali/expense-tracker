import {
  EXPENSE_PROMPTS_CHANGED_EVENT,
  getActiveExpensePrompts,
  getDueExpensePrompts,
  isExpensePromptDue,
  msUntilNextExpensePrompt,
  saveExpenseFromPrompt,
  skipExpensePromptToday,
} from '@/lib/expense-prompts';
import { getCurrencySymbol } from '@/lib/storage';
import { TRANSACTIONS_SYNCED_EVENT } from '@/lib/sync';
import { useTheme } from '@/lib/theme';
import type { ExpensePrompt } from '@/lib/types';
import { formatReminderTime } from '@/lib/reminders';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const SNOOZE_MS = 30 * 60 * 1000;

function promptIdFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { kind?: unknown; promptId?: unknown };
  if (record.kind !== 'expense-prompt') return null;
  return typeof record.promptId === 'string' && record.promptId.length > 0
    ? record.promptId
    : null;
}

function sanitizeAmount(value: string): string {
  const cleaned = value.replace(/[^0-9.]/g, '');
  const dot = cleaned.indexOf('.');
  if (dot < 0) return cleaned.slice(0, 9);
  const whole = cleaned.slice(0, dot).slice(0, 9);
  const fraction = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, 2);
  return `${whole}.${fraction}`;
}

function ExpensePromptPopup({
  prompt,
  onSave,
  onSkip,
  onLater,
}: {
  prompt: ExpensePrompt;
  onSave: (note: string, amount: number) => Promise<void>;
  onSkip: () => Promise<void>;
  onLater: () => void;
}) {
  const { colors } = useTheme();
  const [note, setNote] = useState(prompt.title);
  const [amount, setAmount] = useState('');
  const [symbol, setSymbol] = useState('');
  const [saving, setSaving] = useState(false);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    setNote(prompt.title);
    setAmount('');
    setSaving(false);
    void getCurrencySymbol().then(setSymbol);
    const focusTimer = setTimeout(() => amountRef.current?.focus(), 250);
    return () => clearTimeout(focusTimer);
  }, [prompt.id, prompt.title]);

  const parsed = parseFloat(amount);
  const canSave = note.trim().length > 0 && Number.isFinite(parsed) && parsed > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(note.trim(), parsed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onLater} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <Pressable style={styles.backdrop} onPress={onLater} />
        <View style={styles.center} pointerEvents="box-none">
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.kicker, { color: colors.muted }]}>Expense reminder</Text>
            <Text style={[styles.title, { color: colors.text }]}>{prompt.title}</Text>
            <Text style={[styles.schedule, { color: colors.muted }]}>
              Every day at {formatReminderTime(prompt.time)}
              {prompt.category ? `, ${prompt.category}` : ''}
            </Text>

            <Text style={[styles.label, { color: colors.text }]}>What</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Lunch"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.input,
                {
                  backgroundColor: colors.card2,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
            />

            <Text style={[styles.label, { color: colors.text }]}>Amount</Text>
            <View
              style={[
                styles.amountRow,
                { backgroundColor: colors.card2, borderColor: colors.border },
              ]}
            >
              {symbol ? (
                <Text style={[styles.symbol, { color: colors.muted }]}>{symbol}</Text>
              ) : null}
              <TextInput
                ref={amountRef}
                value={amount}
                onChangeText={(value) => setAmount(sanitizeAmount(value))}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                style={[styles.amountInput, { color: colors.text }]}
              />
            </View>

            <TouchableOpacity
              disabled={!canSave}
              onPress={() => {
                void handleSave();
              }}
              style={[
                styles.saveBtn,
                { backgroundColor: canSave ? colors.primary : colors.card3 },
              ]}
            >
              <Text
                style={[
                  styles.saveBtnText,
                  { color: canSave ? colors.primaryForeground : colors.muted },
                ]}
              >
                {saving ? 'Saving...' : 'Save expense'}
              </Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                onPress={() => {
                  void onSkip();
                }}
                disabled={saving}
                style={styles.secondaryBtn}
              >
                <Text style={[styles.secondaryText, { color: colors.muted }]}>Not today</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onLater} disabled={saving} style={styles.secondaryBtn}>
                <Text style={[styles.secondaryText, { color: colors.text }]}>Later</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function ExpensePromptHost() {
  const [prompt, setPrompt] = useState<ExpensePrompt | null>(null);
  const promptRef = useRef<ExpensePrompt | null>(null);
  const snoozeRef = useRef<Map<string, number>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkingRef = useRef(false);
  const pendingIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const arm = useCallback(async (preferId?: string) => {
    if (preferId) pendingIdRef.current = preferId;
    if (checkingRef.current) return;
    checkingRef.current = true;
    try {
      clearTimer();
      const prefer = pendingIdRef.current;
      pendingIdRef.current = undefined;
      const prompts = await getActiveExpensePrompts();
      const now = new Date();
      const snooze = snoozeRef.current;

      const snoozed = (id: string) => (snooze.get(id) ?? 0) > now.getTime();

      if (!promptRef.current) {
        let next: ExpensePrompt | null = null;
        if (prefer) {
          const preferred = prompts.find(
            (item) => item.id === prefer && isExpensePromptDue(item, now) && !snoozed(item.id),
          );
          if (preferred) next = preferred;
        }
        if (!next) {
          next =
            getDueExpensePrompts(prompts, now).find((item) => !snoozed(item.id)) ?? null;
        }
        if (next) {
          setPrompt(next);
          return;
        }
      }

      if (promptRef.current) return;

      const wait = msUntilNextExpensePrompt(prompts, now, snooze);
      if (wait == null) return;
      timerRef.current = setTimeout(() => {
        void arm();
      }, Math.max(500, wait));
    } finally {
      checkingRef.current = false;
      if (pendingIdRef.current) {
        void arm();
      }
    }
  }, []);

  useEffect(() => {
    void arm();

    const appSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void arm();
    });
    const promptsSub = DeviceEventEmitter.addListener(EXPENSE_PROMPTS_CHANGED_EVENT, () => {
      void arm();
    });

    let received: { remove: () => void } | null = null;
    let responseSub: { remove: () => void } | null = null;
    if (Platform.OS !== 'web') {
      received = Notifications.addNotificationReceivedListener((notification) => {
        const id = promptIdFromData(notification.request.content.data);
        if (id) void arm(id);
      });
      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const id = promptIdFromData(response.notification.request.content.data);
        if (id) void arm(id);
      });
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        if (!response) return;
        const id = promptIdFromData(response.notification.request.content.data);
        if (id) void arm(id);
      });
    }

    return () => {
      appSub.remove();
      promptsSub.remove();
      received?.remove();
      responseSub?.remove();
      clearTimer();
    };
  }, [arm]);

  const closeAndRecheck = (next: ExpensePrompt | null = null) => {
    setPrompt(next);
    promptRef.current = next;
    void arm();
  };

  if (!prompt) return null;

  return (
    <ExpensePromptPopup
      prompt={prompt}
      onLater={() => {
        snoozeRef.current.set(prompt.id, Date.now() + SNOOZE_MS);
        closeAndRecheck(null);
      }}
      onSkip={async () => {
        await skipExpensePromptToday(prompt.id);
        closeAndRecheck(null);
      }}
      onSave={async (note, amount) => {
        try {
          await saveExpenseFromPrompt(prompt, { note, amount });
          DeviceEventEmitter.emit(TRANSACTIONS_SYNCED_EVENT);
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
            () => {},
          );
          closeAndRecheck(null);
        } catch (error) {
          console.warn('[expense-prompt] save failed:', error);
          Alert.alert('Could not save', 'The expense was not added. Try again.');
        }
      }}
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  card: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  schedule: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  amountRow: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbol: {
    fontSize: 18,
    fontWeight: '700',
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: 10,
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
