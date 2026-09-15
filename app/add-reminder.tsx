import {
  applyTime,
  getReminderById,
  ordinalDay,
  parseReminderTime,
  upsertReminder,
} from "@/lib/reminders";
import {
  requestPermissions,
  resyncNotificationSchedules,
} from "@/lib/notifications";
import { useTheme } from "@/lib/theme";
import { ReminderKind } from "@/lib/types";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Calendar, CalendarClock, Timer } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const KINDS: Array<{
  id: ReminderKind;
  title: string;
  subtitle: string;
  Icon: typeof Calendar;
}> = [
  {
    id: "once",
    title: "One time",
    subtitle: "A specific date, no repeat",
    Icon: Calendar,
  },
  {
    id: "monthly",
    title: "Every month",
    subtitle: "Same date each month",
    Icon: CalendarClock,
  },
  {
    id: "interval",
    title: "Every few days",
    subtitle: "Like bike oil every 20 days",
    Icon: Timer,
  },
];

const INTERVAL_PRESETS = [7, 14, 20, 30];
const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

function padTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function bumpTime(time: string, field: "hour" | "minute", delta: number): string {
  const parsed = parseReminderTime(time);
  if (field === "hour") {
    return padTime((parsed.hour + delta + 24) % 24, parsed.minute);
  }
  return padTime(parsed.hour, (parsed.minute + delta + 60) % 60);
}

export default function AddReminderScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { reminderId } = useLocalSearchParams<{ reminderId?: string }>();
  const isEdit = useMemo(
    () => typeof reminderId === "string" && reminderId.length > 0,
    [reminderId],
  );

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [kind, setKind] = useState<ReminderKind>("once");
  const [time, setTime] = useState("09:00");
  const [onceDate, setOnceDate] = useState(() => addDays(new Date(), 1));
  const [monthDay, setMonthDay] = useState(() => new Date().getDate());
  const [intervalDays, setIntervalDays] = useState("20");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() =>
    startOfMonth(addDays(new Date(), 1)),
  );

  useEffect(() => {
    if (!isEdit || !reminderId) return;
    getReminderById(reminderId).then((reminder) => {
      if (!reminder) return;
      setTitle(reminder.title);
      setNote(reminder.note ?? "");
      setKind(reminder.kind);
      setTime(reminder.time);
      setEnabled(reminder.enabled);
      if (reminder.fireAt) {
        const parsed = new Date(reminder.fireAt);
        setOnceDate(parsed);
        setCalendarMonth(startOfMonth(parsed));
      }
      if (reminder.monthDay) setMonthDay(reminder.monthDay);
      if (reminder.intervalDays) setIntervalDays(String(reminder.intervalDays));
    });
  }, [isEdit, reminderId]);

  const parsedIntervalDays = Math.min(
    365,
    Math.max(1, Number(intervalDays) || 1),
  );

  const onSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      Alert.alert("Name needed", "Give this reminder a name.");
      return;
    }

    const fireDate = applyTime(onceDate, time);
    if (kind === "once" && fireDate.getTime() <= Date.now()) {
      Alert.alert("Pick a future time", "One-time reminders need a date and time that is still ahead.");
      return;
    }

    setSaving(true);
    await upsertReminder({
      id: isEdit ? reminderId : undefined,
      title: cleanTitle,
      note,
      kind,
      time,
      fireAt: kind === "once" ? fireDate.toISOString() : undefined,
      monthDay: kind === "monthly" ? monthDay : undefined,
      intervalDays: kind === "interval" ? parsedIntervalDays : undefined,
      enabled,
    });

    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await resyncNotificationSchedules();
    } else {
      Alert.alert(
        "Notifications off",
        "Reminder saved. Turn on notifications to get an alert at the scheduled time.",
      );
    }

    setSaving(false);
    router.back();
  };

  const intervalHint =
    kind === "interval"
      ? `First alert in ${parsedIntervalDays} day${parsedIntervalDays === 1 ? "" : "s"}, then again every ${parsedIntervalDays} day${parsedIntervalDays === 1 ? "" : "s"}. Tap Done after you finish the job to restart the timer.`
      : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {isEdit ? "Edit Reminder" : "New Reminder"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            One-time, monthly, or every few days
          </Text>

          <View style={styles.kindList}>
            {KINDS.map((item) => {
              const active = kind === item.id;
              const Icon = item.Icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => setKind(item.id)}
                  style={[
                    styles.kindCard,
                    {
                      backgroundColor: active ? colors.primaryMuted : colors.card,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.kindIcon,
                      { backgroundColor: active ? colors.primary : colors.card2 },
                    ]}
                  >
                    <Icon
                      size={18}
                      color={active ? colors.primaryForeground : colors.text}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.kindTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.kindSubtitle, { color: colors.muted }]}>
                      {item.subtitle}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

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
              placeholder={
                kind === "interval" ? "Change bike oil" : "Pay internet bill"
              }
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

            <Text style={[styles.label, { color: colors.text }]}>
              Note (optional)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Anything you want on the alert"
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

            {kind === "once" ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>Date</Text>
                <TouchableOpacity
                  onPress={() => {
                    setCalendarMonth(startOfMonth(onceDate));
                    setShowDatePicker(true);
                  }}
                  style={[
                    styles.input,
                    styles.dateBtn,
                    {
                      backgroundColor: colors.card2,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    {format(onceDate, "EEEE, d MMMM yyyy")}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {kind === "monthly" ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>
                  Day of month
                </Text>
                <Text style={[styles.helperText, { color: colors.muted }]}>
                  Remind me on the {ordinalDay(monthDay)} every month
                </Text>
                <View style={styles.dayGrid}>
                  {MONTH_DAYS.map((day) => {
                    const active = monthDay === day;
                    return (
                      <TouchableOpacity
                        key={day}
                        onPress={() => setMonthDay(day)}
                        style={[
                          styles.dayChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.card2,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active
                              ? colors.primaryForeground
                              : colors.text,
                            fontWeight: "700",
                            fontSize: 13,
                          }}
                        >
                          {day}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            ) : null}

            {kind === "interval" ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>
                  Remind every
                </Text>
                <View style={styles.intervalRow}>
                  <TouchableOpacity
                    onPress={() =>
                      setIntervalDays(String(Math.max(1, parsedIntervalDays - 1)))
                    }
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      -
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    value={intervalDays}
                    onChangeText={setIntervalDays}
                    keyboardType="number-pad"
                    style={[
                      styles.input,
                      styles.intervalInput,
                      {
                        backgroundColor: colors.card2,
                        color: colors.text,
                        borderColor: colors.border,
                      },
                    ]}
                  />
                  <TouchableOpacity
                    onPress={() =>
                      setIntervalDays(
                        String(Math.min(365, parsedIntervalDays + 1)),
                      )
                    }
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      +
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.intervalUnit, { color: colors.text }]}>
                    days
                  </Text>
                </View>
                <View style={styles.presetRow}>
                  {INTERVAL_PRESETS.map((preset) => {
                    const active = parsedIntervalDays === preset;
                    return (
                      <TouchableOpacity
                        key={preset}
                        onPress={() => setIntervalDays(String(preset))}
                        style={[
                          styles.presetChip,
                          {
                            backgroundColor: active
                              ? colors.primary
                              : colors.card2,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color: active
                              ? colors.primaryForeground
                              : colors.text,
                            fontWeight: "700",
                            fontSize: 12,
                          }}
                        >
                          {preset}d
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {intervalHint ? (
                  <Text style={[styles.helperText, { color: colors.muted }]}>
                    {intervalHint}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>Time</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeCol}>
                <Text style={[styles.timeColLabel, { color: colors.muted }]}>
                  Hour
                </Text>
                <View style={styles.intervalRow}>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, "hour", -1))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      -
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.timeValue, { color: colors.text }]}>
                    {time.slice(0, 2)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, "hour", 1))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={[styles.timeColon, { color: colors.text }]}>:</Text>
              <View style={styles.timeCol}>
                <Text style={[styles.timeColLabel, { color: colors.muted }]}>
                  Minute
                </Text>
                <View style={styles.intervalRow}>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, "minute", -5))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      -
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.timeValue, { color: colors.text }]}>
                    {time.slice(3)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setTime(bumpTime(time, "minute", 5))}
                    style={[
                      styles.stepBtn,
                      {
                        backgroundColor: colors.card2,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.stepBtnText, { color: colors.text }]}>
                      +
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.switchRow}>
              <Text
                style={[styles.label, { color: colors.text, marginBottom: 0 }]}
              >
                Enable alert
              </Text>
              <Switch value={enabled} onValueChange={setEnabled} />
            </View>
          </View>

          <TouchableOpacity
            disabled={saving || !title.trim()}
            onPress={onSave}
            style={[
              styles.saveBtn,
              {
                backgroundColor:
                  saving || !title.trim() ? colors.card3 : colors.primary,
              },
            ]}
          >
            <Text
              style={[
                styles.saveBtnText,
                {
                  color:
                    saving || !title.trim()
                      ? colors.muted
                      : colors.primaryForeground,
                },
              ]}
            >
              {saving
                ? "Saving..."
                : isEdit
                  ? "Update Reminder"
                  : "Create Reminder"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.dateModalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          />
          <View
            style={[
              styles.dateModalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.dateModalHeader}>
              <TouchableOpacity
                onPress={() => setCalendarMonth((m) => addMonths(m, -1))}
                style={[styles.dateModalChevron, { backgroundColor: colors.card2 }]}
              >
                <Text style={{ color: colors.subtext, fontSize: 18 }}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.dateModalTitle, { color: colors.text }]}>
                {format(calendarMonth, "MMMM yyyy")}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarMonth((m) => addMonths(m, 1))}
                style={[styles.dateModalChevron, { backgroundColor: colors.card2 }]}
              >
                <Text style={{ color: colors.subtext, fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRow}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, idx) => (
                <Text
                  key={idx}
                  style={[styles.weekdayCell, { color: colors.placeholder }]}
                >
                  {d}
                </Text>
              ))}
            </View>
            {(() => {
              const start = startOfWeek(startOfMonth(calendarMonth), {
                weekStartsOn: 0,
              });
              const end = endOfWeek(endOfMonth(calendarMonth), {
                weekStartsOn: 0,
              });
              const days = eachDayOfInterval({ start, end });
              const rows: Date[][] = [];
              for (let i = 0; i < days.length; i += 7) {
                rows.push(days.slice(i, i + 7));
              }
              return rows.map((week, wi) => (
                <View key={wi} style={styles.calendarWeek}>
                  {week.map((day, di) => {
                    const inMonth = isSameMonth(day, calendarMonth);
                    const selected = isSameDay(day, onceDate);
                    return (
                      <TouchableOpacity
                        key={di}
                        style={[
                          styles.dayCell,
                          selected && {
                            backgroundColor: colors.primaryMuted,
                            borderRadius: 10,
                          },
                        ]}
                        onPress={() => {
                          setOnceDate(day);
                          setShowDatePicker(false);
                        }}
                      >
                        <Text
                          style={[
                            styles.dayCellText,
                            { color: colors.text },
                            !inMonth && {
                              color: colors.placeholder,
                              opacity: 0.35,
                            },
                            selected && {
                              color: colors.heading,
                              fontWeight: "800",
                            },
                          ]}
                        >
                          {format(day, "d")}
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
              <Text style={[styles.dateModalCloseText, { color: colors.subtext }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { marginTop: 4, fontSize: 13, marginBottom: 14 },
  kindList: { gap: 8, marginBottom: 14 },
  kindCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  kindIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  kindTitle: { fontSize: 15, fontWeight: "800" },
  kindSubtitle: { fontSize: 12, marginTop: 2 },
  card: { borderRadius: 20, borderWidth: 1, padding: 14 },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 8, marginTop: 10 },
  helperText: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  dateBtn: { justifyContent: "center" },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  dayChip: {
    width: "13%",
    minWidth: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  intervalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  intervalInput: {
    flex: 1,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 20,
  },
  intervalUnit: { fontSize: 15, fontWeight: "700", width: 42 },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBtnText: { fontSize: 20, fontWeight: "700", marginTop: -2 },
  presetRow: { flexDirection: "row", gap: 8, marginTop: 10, marginBottom: 6 },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  timeCol: { flex: 1 },
  timeColLabel: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  timeValue: {
    flex: 1,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
  },
  timeColon: { fontSize: 24, fontWeight: "800", paddingBottom: 6 },
  switchRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  saveBtn: {
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: { fontSize: 16, fontWeight: "800" },
  dateModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dateModalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    zIndex: 1,
  },
  dateModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  dateModalChevron: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dateModalTitle: { fontSize: 16, fontWeight: "700" },
  weekdayRow: { flexDirection: "row", marginBottom: 8 },
  weekdayCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "600",
  },
  calendarWeek: { flexDirection: "row", marginBottom: 4 },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellText: { fontSize: 14, fontWeight: "600" },
  dateModalClose: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  dateModalCloseText: { fontSize: 15, fontWeight: "600" },
});
