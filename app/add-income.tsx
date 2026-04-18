import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { X, Calendar as CalendarIcon, Wallet } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { saveTransaction, getCurrencySymbol } from '@/lib/storage';

export default function AddIncomeScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date());
  const [currencySymbol, setCurrencySymbol] = useState('$');

  useEffect(() => {
    getCurrencySymbol().then(setCurrencySymbol);
  }, []);

  const handleSave = async () => {
    if (!amount || isNaN(parseFloat(amount))) return;

    await saveTransaction(date, {
      id: Math.random().toString(36).substring(7),
      amount: parseFloat(amount),
      date: date.toISOString(),
      note: note.trim() || 'Salary / Bonus',
      type: 'income',
    });

    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        className="flex-1"
      >
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-white/5">
          <TouchableOpacity onPress={() => router.back()}>
            <X color="#9CA3AF" size={24} />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">Add Income</Text>
          <View className="w-6" />
        </View>

        <ScrollView className="flex-1 px-4 py-6">
          <View className="items-center mb-8">
            <View className="w-16 h-16 bg-emerald-500/20 rounded-2xl items-center justify-center mb-4">
              <Wallet color="#10B981" size={32} />
            </View>
            <Text className="text-muted text-sm">How much did you receive?</Text>
          </View>

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

          <View className="mb-6">
            <Text className="text-white mb-2 ml-1 text-sm font-medium">Date</Text>
            <TouchableOpacity className="flex-row items-center bg-card rounded-2xl border border-white/5 px-4 h-14">
              <CalendarIcon color="#9CA3AF" size={20} className="mr-3" />
              <Text className="text-white">{format(date, 'PPP')}</Text>
            </TouchableOpacity>
          </View>

          <View className="mb-8">
            <Text className="text-white mb-2 ml-1 text-sm font-medium">Note (Optional)</Text>
            <Input
              placeholder="e.g. Monthly Salary"
              value={note}
              onChangeText={setNote}
              className="h-14 bg-card border-white/5"
            />
          </View>

          <Button 
            className="bg-accent h-14 rounded-2xl" 
            onPress={handleSave}
            disabled={!amount}
          >
            <Text className="text-black font-bold text-lg">Save Income</Text>
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
