import { getCategories } from '@/lib/storage';
import {
  getExpensePromptById,
  upsertExpensePrompt,
} from '@/lib/expense-prompts';
import {
  requestPermissions,
  resyncNotificationSchedules,
} from '@/lib/notifications';
import { formatReminderTime, parseReminderTime } from '@/lib/reminders';
import { useTheme } from '@/lib/theme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';

function padTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function bumpTime(time: string, field: 'hour' | 'minute', delta: number): string {
  const parsed = parseReminderTime(time);
  if (field === 'hour') {
    return padTime((parsed.hour + delta + 24) % 24, parsed.minute);
  }
  return padTime(parsed.hour, (parsed.minute + delta + 60) % 60);
}

type CategoryOption = { id: string; label: string };

export default function AddExpensePromptScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { promptId } = useLocalSearchParams<{ promptId?: string }>();
  const isEdit = useMemo(
    () => typeof promptId === 'string' && promptId.length > 0,
    [promptId],
  );

  const [title, setTitle] = useState('');
  const [time, setTime] = useState('14:20');
  const [category, setCategory] = useState('Food');
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getCategories().then((rows) => {
      const options = (rows as CategoryOption[]).map((row) => ({
        id: row.id,
        label: row.label,
      }));
      setCategories(options);
    });
  }, []);

  useEffect(() => {
    if (!isEdit || !promptId) return;
    void getExpensePromptById(promptId).then((prompt) => {
      if (!prompt) return;
      setTitle(prompt.title);
      setTime(prompt.time);
      setCategory(prompt.category || 'Food');
      setEnabled(prompt.enabled);
    });
  }, [isEdit, promptId]);

  const onSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert('Name needed', 'Give this prompt a name, like Lunch or Tea.');
      return;
    }

    setSaving(true);
    try {
      await upsertExpensePrompt({
        id: isEdit ? promptId : undefined,
        title: cleanTitle,
        time,
        category,
        enabled,
      });

      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await resyncNotificationSchedules();
      } else if (Platform.OS !== 'web') {
        Alert.alert(
          'Notifications off',
          'Prompt saved. The popup still appears while the app is open. Turn on notifications to get an alert when the app is closed.',
        );
      }
      router.back();
    } catch (error) {
      console.warn('[expense-prompt] save failed:', error);
      Alert.alert('Could not save', 'Try again in a moment.');
    } finally {
      setSaving(false);
    }
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
          <Text style={[styles.title, { color: colors.text }]}>
            {isEdit ? 'Edit expense prompt' : 'New expense prompt'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Every day at this time, a popup asks for the name and amount. Add as many as you want.
          </Text>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.label, { color: colors.text }]}>Name</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
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

            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={styles.chipWrap}>
              {categories.map((item) => {
                const active = category === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => setCategory(item.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? colors.primary : colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? colors.primaryForeground : colors.text,
                        fontWeight: '700',
                        fontSize: 13,
                      }}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>Time</Text>
            <Text style={[styles.helper, { color: colors.muted }]}>
              Popup at {formatReminderTime(time)} every day
            </Text>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={[styles.timeColLabel, { color: colors.muted }]}>Hour</Text>
                <View style={styles.stepRow}>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, 'hour', -1))}
                    style={[
                      styles.stepBtn,
                      { backgroundColor: colors.card2, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.timeValue, { color: colors.text }]}>
                    {time.slice(0, 2)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, 'hour', 1))}
                    style={[
                      styles.stepBtn,
                      { backgroundColor: colors.card2, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.colon, { color: colors.text }]}>:</Text>
              <View style={styles.timeCol}>
                <Text style={[styles.timeColLabel, { color: colors.muted }]}>Minute</Text>
                <View style={styles.stepRow}>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, 'minute', -1))}
                    style={[
                      styles.stepBtn,
                      { backgroundColor: colors.card2, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.timeValue, { color: colors.text }]}>
                    {time.slice(3)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, 'minute', 1))}
                    style={[
                      styles.stepBtn,
                      { backgroundColor: colors.card2, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: colors.text, marginBottom: 0, marginTop: 0 }]}>
                Enable prompt
              </Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </View>

          <TouchableOpacity
            disabled={saving || !title.trim()}
            onPress={() => {
              void onSave();
            }}
            style={[
              styles.saveBtn,
              {
                backgroundColor: saving || !title.trim() ? colors.card3 : colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                {
                  color:
                    saving || !title.trim() ? colors.muted : colors.primaryForeground,
                },
              ]}
            >
              {saving ? 'Saving...' : isEdit ? 'Update prompt' : 'Create prompt'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: '800' },
  subtitle: { fontSize: 13, marginTop: 6, marginBottom: 16, lineHeight: 19 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 10 },
  helper: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  timeCol: { flex: 1 },
  timeColLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 20, fontWeight: '700', marginTop: -2 },
  timeValue: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800' },
  colon: { fontSize: 22, fontWeight: '800', marginBottom: 6 },
  switchRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '800' },
});
