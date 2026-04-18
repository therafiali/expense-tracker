import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { requestPermissions, scheduleDailyReminder } from '@/lib/notifications';
import { getUserProfile } from '@/lib/storage';
import { useRouter, useSegments } from 'expo-router';
import { useState, useEffect } from 'react';
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
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setup() {
      // Setup notifications
      const hasPermission = await requestPermissions();
      if (hasPermission) {
        await scheduleDailyReminder();
      }

      // Check onboarding
      const profile = await getUserProfile();
      const inAuthGroup = segments[0] === 'currency-setup';

      if (!profile && !inAuthGroup) {
        router.replace('/currency-setup');
      }
      
      setIsReady(true);
    }
    setup();
  }, [segments]);

  if (!isReady) return null;

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
