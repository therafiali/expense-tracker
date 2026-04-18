import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TouchableOpacity, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, FileDown, TrendingDown, TrendingUp, PieChart, ArrowLeft } from 'lucide-react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getMonthData, getSummaries, getCategoryBreakdown, getCurrencySymbol, type MonthData, type Transaction, type Category } from '@/lib/storage';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/category-icon';
import { cn } from '@/lib/utils';

export default function ReportsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<MonthData>({ income: [], expenses: [] });
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    const [monthData, symbol] = await Promise.all([
      getMonthData(currentDate),
      getCurrencySymbol()
    ]);
    setData(monthData);
    setCurrencySymbol(symbol);
    setLoading(false);
  };

  const { totalIncome, totalExpenses, balance } = getSummaries(data);
  const breakdown = getCategoryBreakdown(data.expenses);
  const highestExpense = [...data.expenses].sort((a, b) => b.amount - a.amount)[0];

  const nextMonth = () => setCurrentDate(subMonths(currentDate, -1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const exportPDF = async () => {
    const html = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            h1 { color: #10B981; margin-bottom: 5px; }
            .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .card { background: #f9f9f9; padding: 20px; border-radius: 10px; flex: 1; margin: 0 10px; text-align: center; }
            .card h3 { margin: 0; font-size: 14px; color: #666; }
            .card p { margin: 10px 0 0; font-size: 24px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; border-bottom: 1px solid #eee; padding: 10px; color: #666; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .category-tag { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>WalletWatch Report</h1>
            <p>${format(currentDate, 'MMMM yyyy')}</p>
          </div>
          <div class="summary">
            <div class="card"><h3>Total Income</h3><p>${currencySymbol}${totalIncome.toFixed(2)}</p></div>
            <div class="card"><h3>Total Expenses</h3><p>${currencySymbol}${totalExpenses.toFixed(2)}</p></div>
            <div class="card"><h3>Net Balance</h3><p>${currencySymbol}${balance.toFixed(2)}</p></div>
          </div>
          <h2>Transaction History</h2>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Note</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${[...data.income, ...data.expenses]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map(t => `
                <tr>
                  <td>${format(new Date(t.date), 'MMM dd')}</td>
                  <td><span class="category-tag" style="background: ${t.type === 'income' ? '#D1FAE5' : '#FEE2E2'}; color: ${t.type === 'income' ? '#065F46' : '#991B1B'}">${t.category || (t.type === 'income' ? 'Income' : 'Other')}</span></td>
                  <td>${t.note || '-'}</td>
                  <td style="color: ${t.type === 'income' ? '#10B981' : '#EF4444'}"><b>${t.type === 'income' ? '+' : '-'}${currencySymbol}${t.amount.toFixed(2)}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Export Report' });
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  if (selectedCategory) {
    const categoryTransactions = data.expenses.filter(t => t.category === selectedCategory);
    const catTotal = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);

    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-4 border-b border-white/5">
          <TouchableOpacity onPress={() => setSelectedCategory(null)} className="mr-4">
            <ArrowLeft color="#9CA3AF" size={24} />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">{selectedCategory} Details</Text>
        </View>
        <ScrollView className="flex-1 px-4 py-6">
          <Card className="p-6 mb-8 items-center bg-accent/5 border-accent/20">
            <Text className="text-muted text-sm mb-2">Total spent in {selectedCategory}</Text>
            <Text className="text-white text-4xl font-bold">{currencySymbol}{catTotal.toFixed(2)}</Text>
          </Card>
          
          <Text className="text-white font-semibold mb-4">Transactions</Text>
          {categoryTransactions.length === 0 ? (
            <Text className="text-muted italic">No transactions found.</Text>
          ) : (
            categoryTransactions
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .map(t => (
                <Card key={t.id} className="flex-row items-center p-4 mb-3">
                  <View className="flex-1">
                    <Text className="text-white font-medium">{t.note || 'No note'}</Text>
                    <Text className="text-muted text-xs">{format(new Date(t.date), 'PPPP')}</Text>
                  </View>
                  <Text className="text-red-400 font-bold">-{currencySymbol}{t.amount.toFixed(2)}</Text>
                </Card>
              ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4">
        {/* Header */}
        <View className="flex-row items-center justify-between py-6">
          <Text className="text-2xl font-bold text-white">Analytics</Text>
          <TouchableOpacity 
            onPress={exportPDF}
            className="flex-row items-center bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-full"
          >
            <FileDown size={18} color="#10B981" />
            <Text className="text-accent text-sm font-medium ml-2">Export PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Month Selector */}
        <View className="flex-row items-center justify-center mb-8">
          <TouchableOpacity onPress={prevMonth} className="p-2 bg-card rounded-full border border-white/5">
            <ChevronLeft size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <Text className="text-white font-bold px-6 text-lg">
            {format(currentDate, 'MMMM yyyy')}
          </Text>
          <TouchableOpacity onPress={nextMonth} className="p-2 bg-card rounded-full border border-white/5">
            <ChevronRight size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View className="flex-row gap-4 mb-8">
          <Card className="flex-1 p-4 border-emerald-500/20">
            <TrendingUp size={20} color="#10B981" className="mb-2" />
            <Text className="text-muted text-xs">Monthly Income</Text>
            <Text className="text-emerald-500 text-xl font-bold">{currencySymbol}{totalIncome.toFixed(0)}</Text>
          </Card>
          <Card className="flex-1 p-4 border-red-500/20">
            <TrendingDown size={20} color="#EF4444" className="mb-2" />
            <Text className="text-muted text-xs">Monthly Spending</Text>
            <Text className="text-red-400 text-xl font-bold">{currencySymbol}{totalExpenses.toFixed(0)}</Text>
          </Card>
        </View>

        {/* Category Breakdown (Enhanced) */}
        <View className="mb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white font-bold text-lg">Category Analytics</Text>
            <PieChart size={20} color="#9CA3AF" />
          </View>
          
          {breakdown.length === 0 ? (
            <Card className="p-8 items-center border-dashed border-white/10 bg-transparent">
              <Text className="text-muted italic">No spending data for this month.</Text>
            </Card>
          ) : (
            <View className="gap-4">
              {breakdown.map((item) => {
                const Icon = CATEGORY_ICONS[item.category];
                const color = CATEGORY_COLORS[item.category];
                return (
                  <TouchableOpacity 
                    key={item.category}
                    onPress={() => setSelectedCategory(item.category)}
                    activeOpacity={0.7}
                  >
                    <Card className="p-4 border-white/5">
                      <View className="flex-row items-center justify-between mb-3">
                        <View className="flex-row items-center gap-3">
                          <View 
                            className="w-10 h-10 rounded-xl items-center justify-center"
                            style={{ backgroundColor: `${color}15` }}
                          >
                            <Icon size={20} color={color} />
                          </View>
                          <View>
                            <Text className="text-white font-semibold">{item.category}</Text>
                            <Text className="text-muted text-xs">{item.percentage.toFixed(1)}% of total</Text>
                          </View>
                        </View>
                        <Text className="text-white font-bold">{currencySymbol}{item.amount.toFixed(0)}</Text>
                      </View>
                      <View className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <View 
                          className="h-full rounded-full" 
                          style={{ width: `${item.percentage}%`, backgroundColor: color }} 
                        />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Highest Expense Insights */}
        {highestExpense && (
          <View className="mb-10">
            <Text className="text-white font-bold text-lg mb-4">Highest Spending</Text>
            <Card className="p-4 border-red-500/30 bg-red-500/5">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-red-500/20 rounded-full items-center justify-center">
                    <TrendingDown size={24} color="#EF4444" />
                  </View>
                  <View>
                    <Text className="text-white font-bold">{currencySymbol}{highestExpense.amount.toFixed(2)}</Text>
                    <Text className="text-muted text-xs">{highestExpense.note || highestExpense.category}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-red-400 font-medium text-xs">Top Expense</Text>
                  <Text className="text-muted text-[10px]">{format(new Date(highestExpense.date), 'MMM d, yyyy')}</Text>
                </View>
              </View>
            </Card>
          </View>
        )}

        <View className="h-32" />
      </ScrollView>
    </SafeAreaView>
  );
}
