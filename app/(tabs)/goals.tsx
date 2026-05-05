import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Plus, Bell, BellOff, Minus, Check } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import {
  adjustGoalProgress,
  archiveGoal,
  getActiveGoals,
  getGoalProgressSummary,
  syncGoalPeriods,
} from '@/lib/goals';
import { Goal } from '@/lib/types';
import { requestPermissions, syncGoalReminderSchedules } from '@/lib/notifications';

const PERIOD_LABEL: Record<Goal['period'], string> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
};

function GoalCard({
  goal,
  totalDone,
  thisMonthDone,
  onIncrement,
  onDecrement,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  totalDone: number;
  thisMonthDone: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  const progress = Math.min(100, Math.round((goal.completedCount / goal.targetCount) * 100));

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={[styles.goalCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onEdit}
    >
      <View style={styles.goalHeader}>
        <View style={styles.goalTitleRow}>
          <Text style={styles.goalEmoji}>{goal.emoji || '🎯'}</Text>
          <View>
            <Text style={[styles.goalTitle, { color: colors.text }]}>{goal.title}</Text>
            <Text style={[styles.goalMeta, { color: colors.muted }]}>
              {goal.targetCount} times per {PERIOD_LABEL[goal.period]}
            </Text>
          </View>
        </View>
        <View style={styles.goalRemindFlag}>
          {goal.reminderEnabled ? (
            <Bell size={17} color={colors.primary} />
          ) : (
            <BellOff size={17} color={colors.muted} />
          )}
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.card2 }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
      </View>

      <View style={styles.progressRow}>
        <Text style={[styles.progressText, { color: colors.text }]}>
          {goal.completedCount}/{goal.targetCount}
        </Text>
        <Text style={[styles.progressSubText, { color: colors.muted }]}>{progress}% complete</Text>
      </View>

      <View style={[styles.statsCard, { backgroundColor: colors.card2, borderColor: colors.border }]}>
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: colors.text }]}>{totalDone}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Total done</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={[styles.statValue, { color: colors.text }]}>{thisMonthDone}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Done this month</Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.roundBtn, { borderColor: colors.border, backgroundColor: colors.card2 }]}
          onPress={onDecrement}
        >
          <Minus size={18} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.doneBtn, { backgroundColor: colors.primaryMuted, borderColor: colors.border }]}
          onPress={onIncrement}
        >
          <Check size={20} color={colors.primary} />
          <Text style={[styles.doneBtnLabel, { color: colors.primary }]}>Done</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roundBtn, { borderColor: colors.border, backgroundColor: colors.card2 }]}
          onPress={onDelete}
        >
          <Text style={[styles.deleteText, { color: '#EF4444' }]}>×</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function GoalsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summaries, setSummaries] = useState<Record<string, { totalDone: number; thisMonthDone: number }>>({});

  const loadGoals = useCallback(async () => {
    setLoading(true);
    const next = await syncGoalPeriods();
    setGoals(next);
    const summaryRows = await Promise.all(
      next.map(async (goal) => ({ goalId: goal.id, summary: await getGoalProgressSummary(goal.id) })),
    );
    setSummaries(
      summaryRows.reduce<Record<string, { totalDone: number; thisMonthDone: number }>>((acc, row) => {
        acc[row.goalId] = row.summary;
        return acc;
      }, {}),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isFocused) return;
    void loadGoals();
  }, [isFocused, loadGoals]);

  const hasGoals = useMemo(() => goals.length > 0, [goals]);

  const updateAndResync = useCallback(async () => {
    const latest = await getActiveGoals();
    setGoals(latest);
    const summaryRows = await Promise.all(
      latest.map(async (goal) => ({ goalId: goal.id, summary: await getGoalProgressSummary(goal.id) })),
    );
    setSummaries(
      summaryRows.reduce<Record<string, { totalDone: number; thisMonthDone: number }>>((acc, row) => {
        acc[row.goalId] = row.summary;
        return acc;
      }, {}),
    );
    const hasPermission = await requestPermissions();
    if (hasPermission) {
      await syncGoalReminderSchedules(latest);
    }
  }, []);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadGoals} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.heading, { color: colors.text }]}>Goals & Reminders</Text>
            <Text style={[styles.subheading, { color: colors.muted }]}>
              Build habits with daily, weekly, monthly targets
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addTopBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/add-goal')}
          >
            <Plus size={20} color={colors.primaryForeground} />
          </TouchableOpacity>
        </View>

        {!hasGoals ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No goals yet</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              Add your first goal like 8 glasses/day, namaz 5/day, petrol weekly.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/add-goal')}
            >
              <Text style={[styles.createBtnText, { color: colors.primaryForeground }]}>Create Goal</Text>
            </TouchableOpacity>
          </View>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              totalDone={summaries[goal.id]?.totalDone ?? goal.completedCount}
              thisMonthDone={summaries[goal.id]?.thisMonthDone ?? goal.completedCount}
              onIncrement={async () => {
                await adjustGoalProgress(goal.id, 1);
                await updateAndResync();
              }}
              onDecrement={async () => {
                await adjustGoalProgress(goal.id, -1);
                await updateAndResync();
              }}
              onEdit={() => router.push({ pathname: '/add-goal', params: { goalId: goal.id } })}
              onDelete={() =>
                Alert.alert('Delete goal?', `Remove "${goal.title}"`, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await archiveGoal(goal.id);
                      await updateAndResync();
                    },
                  },
                ])
              }
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24, gap: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  heading: { fontSize: 24, fontWeight: '800' },
  subheading: { fontSize: 13, marginTop: 4, maxWidth: 280 },
  addTopBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { borderRadius: 20, borderWidth: 1, padding: 20, alignItems: 'center', marginTop: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  createBtn: { marginTop: 16, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 999 },
  createBtnText: { fontSize: 14, fontWeight: '700' },
  goalCard: { borderWidth: 1, borderRadius: 22, padding: 16, gap: 12 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  goalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  goalEmoji: { fontSize: 24 },
  goalTitle: { fontSize: 17, fontWeight: '700' },
  goalMeta: { fontSize: 12, marginTop: 2 },
  goalRemindFlag: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressText: { fontSize: 16, fontWeight: '800' },
  progressSubText: { fontSize: 12 },
  statsCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCol: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtn: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  doneBtnLabel: { fontSize: 15, fontWeight: '700' },
  deleteText: { fontSize: 28, lineHeight: 28, marginTop: -3 },
});
