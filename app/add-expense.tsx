import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { X, ArrowLeft, Calendar as CalendarIcon, Check } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveTransaction, getCurrencySymbol, type Category } from '@/lib/storage';
import { CATEGORY_ICONS, CATEGORY_COLORS } from '@/components/category-icon';

const CATEGORIES: Category[] = ['Food', 'Petrol', 'Repair', 'Shopping', 'Course', 'Education', 'Other'];

export default function AddExpenseScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState<Category | null>(null);
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    getCurrencySymbol().then(setCurrencySymbol);
  }, []);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount)) || !category) return;

    await saveTransaction(date, {
      id: Math.random().toString(36).substring(7),
      amount: parseFloat(amount),
      date: date.toISOString(),
      note: note.trim(),
      category: category,
      type: 'expense',
    });

    router.back();
  };

  const renderHeader = () => (
    <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/5">
      <TouchableOpacity onPress={() => step > 1 ? setStep(step - 1) : router.back()}>
        {step > 1 ? <ArrowLeft color="#9CA3AF" size={24} /> : <X color="#9CA3AF" size={24} />}
      </TouchableOpacity>
      <Text className="text-white font-bold text-lg">Add Expense</Text>
      <View className="flex-row items-center gap-1">
        {[1, 2, 3].map((s) => (
          <View 
            key={s} 
            className={`w-2 h-2 rounded-full ${s === step ? 'bg-accent' : 'bg-white/10'}`} 
          />
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        {renderHeader()}

        <View className="flex-1">
          {step === 1 && (
            <View className="flex-1 px-4 py-6">
              <Text className="text-white text-xl font-bold mb-6">Select Category</Text>
              <FlatList
                data={CATEGORIES}
                numColumns={2}
                columnWrapperStyle={{ gap: 12 }}
                contentContainerStyle={{ gap: 12 }}
                keyExtractor={(item) => item}
                renderItem={({ item }) => {
                  const Icon = CATEGORY_ICONS[item];
                  const color = CATEGORY_COLORS[item];
                  const isSelected = category === item;
                  
                  return (
                    <TouchableOpacity 
                      className={`flex-1 p-4 rounded-3xl border ${isSelected ? 'border-accent bg-accent/5' : 'border-white/5 bg-card'} items-center`}
                      onPress={() => {
                        setCategory(item);
                        setStep(2);
                      }}
                    >
                      <View 
                        className="w-12 h-12 rounded-2xl items-center justify-center mb-3"
                        style={{ backgroundColor: `${color}20` }}
                      >
                        <Icon size={24} color={color} />
                      </View>
                      <Text className={`font-semibold ${isSelected ? 'text-accent' : 'text-white'}`}>{item}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          )}

          {step === 2 && (
            <View className="flex-1 px-4 py-6">
              <Text className="text-white text-xl font-bold mb-2">Add a Note</Text>
              <Text className="text-muted mb-8">What was this expense for?</Text>
              
              <Input
                placeholder="e.g. Weekly Groceries"
                value={note}
                onChangeText={setNote}
                className="h-16 bg-card border-white/5 text-lg"
                autoFocus
              />

              <View className="flex-1" />
              
              <Button 
                className="bg-accent h-14 rounded-2xl" 
                onPress={() => setStep(3)}
              >
                <Text className="text-black font-bold text-lg">Next</Text>
              </Button>
            </View>
          )}

          {step === 3 && (
            <View className="flex-1 px-4 py-6">
              <Text className="text-white text-xl font-bold mb-6">Details</Text>

              <View className="mb-6">
                <Text className="text-white mb-2 ml-1 text-sm font-medium">Amount</Text>
                <View className="flex-row items-center bg-card rounded-2xl border border-white/5 px-4 h-16">
                  <Text className="text-white text-2xl mr-2">{currencySymbol}</Text>
                  <TextInput
                    className="flex-1 text-white text-2xl font-bold"
                    placeholder="0.00"
                    placeholderTextColor="#4B5563"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    autoFocus
                  />
                </View>
              </View>

              <View className="mb-10">
                <Text className="text-white mb-2 ml-1 text-sm font-medium">Date</Text>
                <TouchableOpacity className="flex-row items-center bg-card rounded-2xl border border-white/5 px-4 h-14">
                  <CalendarIcon color="#9CA3AF" size={20} className="mr-3" />
                  <Text className="text-white">{format(date, 'PPP')}</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-1" />

              <Button 
                className="bg-accent h-14 rounded-2xl" 
                onPress={handleSave}
                disabled={!amount}
              >
                <Text className="text-black font-bold text-lg">Finish</Text>
              </Button>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
