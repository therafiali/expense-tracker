import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { requestPermissions, scheduleDailyReminder } from '@/lib/notifications';
import '../global.css';

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#0F0F0F',
    card: '#1A1A1A',
    text: '#FFFFFF',
    border: '#ffffff10',
  },
};

export default function RootLayout() {
  useEffect(() => {
    async function setupNotifications() {
      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await scheduleDailyReminder();
      }
    }
    setupNotifications();
  }, []);

  return (
    <ThemeProvider value={CustomDarkTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="add-income" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom'
          }} 
        />
        <Stack.Screen 
          name="add-expense" 
          options={{ 
            presentation: 'modal',
            animation: 'slide_from_bottom'
          }} 
        />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
