import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/lib/theme';
import { GoalPeriod, GoalReminderSlot } from '@/lib/types';
import { getGoalById, getActiveGoals, upsertGoal } from '@/lib/goals';
import { requestPermissions, syncGoalReminderSchedules } from '@/lib/notifications';

const PERIODS: GoalPeriod[] = ['daily', 'weekly', 'monthly'];
const PERIOD_UNIT_LABEL: Record<GoalPeriod, string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};

const NAMAZ_SLOTS: Array<{ label: string; time: string }> = [
  { label: 'Fajr', time: '05:00' },
  { label: 'Dhuhr', time: '13:00' },
  { label: 'Asr', time: '16:30' },
  { label: 'Maghrib', time: '18:30' },
  { label: 'Isha', time: '20:00' },
];

function createSlot(label = '', time = ''): GoalReminderSlot {
  return {
    id: `slot-${Math.random().toString(36).slice(2, 10)}`,
    label,
    time,
  };
}

export default function AddGoalScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { goalId } = useLocalSearchParams<{ goalId?: string }>();
  const isEdit = useMemo(() => typeof goalId === 'string' && goalId.length > 0, [goalId]);

  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('💧');
  const [targetCount, setTargetCount] = useState('1');
  const [period, setPeriod] = useState<GoalPeriod>('daily');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [useCustomTimes, setUseCustomTimes] = useState(false);
  const [remindersPerPeriod, setRemindersPerPeriod] = useState('1');
  const [reminderTime, setReminderTime] = useState('09:00');
  const [reminderSlots, setReminderSlots] = useState<GoalReminderSlot[]>([createSlot()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit || !goalId) return;
    getGoalById(goalId).then((goal) => {
      if (!goal) return;
      setTitle(goal.title);
      setEmoji(goal.emoji || '');
      setTargetCount(String(goal.targetCount));
      setPeriod(goal.period);
      setReminderEnabled(goal.reminderEnabled);
      setRemindersPerPeriod(String(goal.remindersPerPeriod));
      setReminderTime(goal.reminderTime);
      if (goal.reminderSlots && goal.reminderSlots.length > 0) {
        setUseCustomTimes(true);
        setReminderSlots(goal.reminderSlots);
      }
    });
  }, [goalId, isEdit]);

  useEffect(() => {
    if (period !== 'daily' && useCustomTimes) {
      setUseCustomTimes(false);
    }
  }, [period, useCustomTimes]);

  const setSlotLabel = (slotId: string, label: string) => {
    setReminderSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, label } : slot)));
  };

  const setSlotTime = (slotId: string, time: string) => {
    setReminderSlots((prev) => prev.map((slot) => (slot.id === slotId ? { ...slot, time } : slot)));
  };

  const addSlot = () => setReminderSlots((prev) => [...prev, createSlot()]);
  const removeSlot = (slotId: string) =>
    setReminderSlots((prev) => (prev.length <= 1 ? prev : prev.filter((slot) => slot.id !== slotId)));

  const onSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    setSaving(true);
    await upsertGoal({
      id: isEdit ? goalId : undefined,
      title: cleanTitle,
      emoji,
      targetCount: Number(targetCount) || 1,
      period,
      reminderEnabled,
      remindersPerPeriod: Number(remindersPerPeriod) || 1,
      reminderTime,
      reminderSlots: useCustomTimes ? reminderSlots : [],
    });

    const goals = await getActiveGoals();
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await syncGoalReminderSchedules(goals);
    }

    setSaving(false);
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>{isEdit ? 'Edit Goal' : 'Create Goal'}</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Set target and reminders for habit tracking</Text>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Goal Name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Drink water"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.text }]}>Emoji (optional)</Text>
            <TextInput
              value={emoji}
              onChangeText={setEmoji}
              placeholder="💧"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.text }]}>Target Count</Text>
            <TextInput
              value={targetCount}
              onChangeText={setTargetCount}
              keyboardType="number-pad"
              placeholder="8"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.text }]}>Repeat Period</Text>
            <View style={styles.segmentRow}>
              {PERIODS.map((item) => {
                const active = period === item;
                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setPeriod(item)}
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: active ? colors.primary : colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? colors.primaryForeground : colors.text, fontWeight: '700' }}>
                      {item[0].toUpperCase() + item.slice(1)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Enable Reminder</Text>
              <Switch value={reminderEnabled} onValueChange={setReminderEnabled} />
            </View>

            {period === 'daily' ? (
              <View style={styles.switchRow}>
                <Text style={[styles.label, { color: colors.text, marginBottom: 0 }]}>Use custom exact times</Text>
                <Switch value={useCustomTimes} onValueChange={setUseCustomTimes} />
              </View>
            ) : null}

            {useCustomTimes && period === 'daily' ? (
              <View style={styles.customTimeWrap}>
                <View style={styles.namazRow}>
                  <Text style={[styles.helperText, { color: colors.muted }]}>Add labels + time (HH:mm)</Text>
                  <TouchableOpacity
                    onPress={() => setReminderSlots(NAMAZ_SLOTS.map((slot) => createSlot(slot.label, slot.time)))}
                    style={[styles.namazPresetBtn, { backgroundColor: colors.primaryMuted }]}
                  >
                    <Text style={[styles.namazPresetText, { color: colors.heading }]}>Use Namaz Preset</Text>
                  </TouchableOpacity>
                </View>
                {reminderSlots.map((slot, index) => (
                  <View key={slot.id} style={styles.customSlotRow}>
                    <TextInput
                      value={slot.label || ''}
                      onChangeText={(label) => setSlotLabel(slot.id, label)}
                      placeholder={`Label ${index + 1}`}
                      placeholderTextColor={colors.placeholder}
                      style={[
                        styles.input,
                        styles.slotLabelInput,
                        { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border },
                      ]}
                    />
                    <TextInput
                      value={slot.time}
                      onChangeText={(time) => setSlotTime(slot.id, time)}
                      placeholder="HH:mm"
                      placeholderTextColor={colors.placeholder}
                      style={[
                        styles.input,
                        styles.slotTimeInput,
                        { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => removeSlot(slot.id)}
                      style={[styles.removeSlotBtn, { backgroundColor: colors.card2, borderColor: colors.border }]}
                    >
                      <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '700' }}>-</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity onPress={addSlot} style={[styles.addSlotBtn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>+ Add exact time</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Reminders per {PERIOD_UNIT_LABEL[period]}</Text>
                <TextInput
                  value={remindersPerPeriod}
                  onChangeText={setRemindersPerPeriod}
                  keyboardType="number-pad"
                  placeholder="1"
                  placeholderTextColor={colors.placeholder}
                  style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
                />

                <Text style={[styles.label, { color: colors.text }]}>Reminder Time (HH:mm)</Text>
                <TextInput
                  value={reminderTime}
                  onChangeText={setReminderTime}
                  placeholder="09:00"
                  placeholderTextColor={colors.placeholder}
                  style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
                />
              </>
            )}
          </View>

          <TouchableOpacity
            disabled={saving || !title.trim()}
            onPress={onSave}
            style={[
              styles.saveBtn,
              {
                backgroundColor: saving || !title.trim() ? colors.card3 : colors.primary,
              },
            ]}
          >
            <Text style={[styles.saveBtnText, { color: saving || !title.trim() ? colors.muted : colors.primaryForeground }]}>
              {saving ? 'Saving...' : isEdit ? 'Update Goal' : 'Create Goal'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { marginTop: 4, fontSize: 13, marginBottom: 14 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  switchRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  customTimeWrap: { marginTop: 10, gap: 8 },
  helperText: { fontSize: 12 },
  namazRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  namazPresetBtn: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  namazPresetText: { fontSize: 12, fontWeight: '700' },
  customSlotRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  slotLabelInput: { flex: 1 },
  slotTimeInput: { width: 92 },
  removeSlotBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSlotBtn: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
});
