import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, Text, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, ArrowUpRight, ArrowDownLeft } from 'lucide-react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMonthData, getSummaries, getCategoryBreakdown, getCurrencySymbol, type MonthData, type Transaction } from '@/lib/storage';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/category-icon';
import { cn } from '@/lib/utils';

export default function DashboardScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [loading, setLoading] = useState(true);
  const isFocused = useIsFocused();
  const router = useRouter();
  const [currencySymbol, setCurrencySymbol] = useState('$');

  const loadData = useCallback(async () => {
    setLoading(true);
    const [monthData, symbol] = await Promise.all([
      getMonthData(currentDate),
      getCurrencySymbol()
    ]);
    setData(monthData);
    setCurrencySymbol(symbol);
    setLoading(false);
  }, [currentDate]);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, loadData]);

  const { totalIncome, totalExpenses, balance } = getSummaries(data);
  const breakdown = getCategoryBreakdown(data.expenses);
  const recentTransactions = [...data.income, ...data.expenses]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView 
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor="#10B981" />}
      >
        {/* Header & Month Switcher */}
        <View className="flex-row items-center justify-between py-6">
          <Text className="text-2xl font-bold text-white">WalletWatch</Text>
          <View className="flex-row items-center bg-card rounded-full px-3 py-1.5 border border-white/5">
            <TouchableOpacity onPress={prevMonth} className="p-1">
              <ChevronLeft size={20} color="#9CA3AF" />
            </TouchableOpacity>
            <Text className="text-white font-medium px-4 min-w-[120px] text-center">
              {format(currentDate, 'MMMM yyyy')}
            </Text>
            <TouchableOpacity onPress={nextMonth} className="p-1">
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary Cards */}
        <View className="flex-row gap-3 mb-6">
          <Card className="flex-1 p-3 items-center justify-center">
            <Text className="text-muted text-xs mb-1">Income</Text>
            <Text className="text-emerald-500 font-bold text-lg">{currencySymbol}{totalIncome.toFixed(0)}</Text>
          </Card>
          <Card className="flex-1 p-3 items-center justify-center">
            <Text className="text-muted text-xs mb-1">Expenses</Text>
            <Text className="text-red-400 font-bold text-lg">{currencySymbol}{totalExpenses.toFixed(0)}</Text>
          </Card>
          <Card className="flex-1 p-3 items-center justify-center border-accent/20">
            <Text className="text-muted text-xs mb-1">Balance</Text>
            <Text className="text-white font-bold text-lg">{currencySymbol}{balance.toFixed(0)}</Text>
          </Card>
        </View>

        {/* Visual Breakdown */}
        {breakdown.length > 0 && (
          <View className="mb-8">
            <Text className="text-white font-semibold mb-4">Spending Breakdown</Text>
            <Card className="p-4">
              <View className="h-3 w-full bg-white/5 rounded-full overflow-hidden flex-row mb-4">
                {breakdown.map((item, index) => (
                  <View 
                    key={item.category}
                    style={{ 
                      width: `${item.percentage}%`, 
                      backgroundColor: CATEGORY_COLORS[item.category] 
                    }}
                    className="h-full"
                  />
                ))}
              </View>
              <View className="flex-row flex-wrap gap-x-4 gap-y-2">
                {breakdown.slice(0, 4).map((item) => (
                  <View key={item.category} className="flex-row items-center gap-2">
                    <View 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: CATEGORY_COLORS[item.category] }} 
                    />
                    <Text className="text-muted text-xs">{item.category}</Text>
                    <Text className="text-white text-xs font-medium">{item.percentage.toFixed(0)}%</Text>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        )}

        {/* Recent Transactions */}
        <View className="mb-10">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-semibold">Recent Transactions</Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity>
                <Text className="text-accent text-xs">See All</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {recentTransactions.length === 0 ? (
            <Card className="p-10 items-center justify-center border-dashed border-white/10 bg-transparent">
              <Text className="text-muted text-center italic">No transactions this month yet.</Text>
            </Card>
          ) : (
            <View className="gap-3">
              {recentTransactions.map((t) => {
                const Icon = t.type === 'income' ? ArrowUpRight : (t.category ? CATEGORY_ICONS[t.category] : ArrowDownLeft);
                const color = t.type === 'income' ? '#10B981' : (t.category ? CATEGORY_COLORS[t.category] : '#EF4444');
                
                return (
                  <Card key={t.id} className="flex-row items-center p-3">
                    <View 
                      className="w-10 h-10 rounded-xl items-center justify-center mr-3"
                      style={{ backgroundColor: `${color}20` }}
                    >
                      <Icon size={20} color={color} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-medium">
                        {t.type === 'income' ? 'Income' : t.category}
                      </Text>
                      <Text className="text-muted text-xs" numberOfLines={1}>
                        {t.note || format(new Date(t.date), 'MMM d, h:mm a')}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className={cn("font-bold", t.type === 'income' ? "text-emerald-500" : "text-white")}>
                        {t.type === 'income' ? '+' : '-'}{currencySymbol}{t.amount.toFixed(2)}
                      </Text>
                      {t.type === 'expense' && (
                        <Text className="text-[10px] text-muted">{format(new Date(t.date), 'MMM d')}</Text>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
        <View className="h-32" />
      </ScrollView>
    </SafeAreaView>
  );
}
