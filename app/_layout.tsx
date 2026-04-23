import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { requestPermissions, scheduleDailyReminder } from '@/lib/notifications';
import { getUserProfile } from '@/lib/storage';
import { useRouter, useSegments } from 'expo-router';
import { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from '@/lib/theme';
import '../global.css';

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    async function setup() {
      const hasPermission = await requestPermissions();
      if (hasPermission) await scheduleDailyReminder();

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

  const navTheme = isDark ? {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  } : {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: colors.bg,
      card: colors.card,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <NavigationThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add-transaction"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
