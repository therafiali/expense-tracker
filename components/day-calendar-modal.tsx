import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { radii } from '@/constants/designTokens';
import { useTheme } from '@/lib/theme';

export function DayCalendarModal({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: Date;
  onClose: () => void;
  onSelect: (day: Date) => void;
}) {
  const { colors } = useTheme();
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(value));

  useEffect(() => {
    if (visible) setCalendarMonth(startOfMonth(value));
  }, [visible, value]);

  const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 0 });
  const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start, end });
  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) rows.push(days.slice(i, i + 7));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={onClose} />
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setCalendarMonth((month) => addMonths(month, -1))}
              style={[styles.chevron, { backgroundColor: colors.card2 }]}
            >
              <ChevronLeft size={20} color={colors.subtext} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>{format(calendarMonth, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => setCalendarMonth((month) => addMonths(month, 1))}
              style={[styles.chevron, { backgroundColor: colors.card2 }]}
            >
              <ChevronRight size={20} color={colors.subtext} />
            </TouchableOpacity>
          </View>
          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, index) => (
              <Text key={index} style={[styles.weekday, { color: colors.placeholder }]}>
                {label}
              </Text>
            ))}
          </View>
          {rows.map((week, weekIndex) => (
            <View key={weekIndex} style={styles.week}>
              {week.map((day, dayIndex) => {
                const inMonth = isSameMonth(day, calendarMonth);
                const selected = isSameDay(day, value);
                return (
                  <TouchableOpacity
                    key={dayIndex}
                    style={[styles.day, selected && { backgroundColor: colors.primaryMuted }]}
                    onPress={() => onSelect(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
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
          <TouchableOpacity style={[styles.close, { backgroundColor: colors.card2 }]} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.subtext }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  chevron: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  week: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  day: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
  },
  close: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
