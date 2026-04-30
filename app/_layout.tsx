import { requestPermissions, scheduleDailyReminder } from "@/lib/notifications";
import { getUserProfile } from "@/lib/storage";
import { ThemeProvider, useTheme } from "@/lib/theme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { Alert } from "react-native";
import "../global.css";

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    async function setup() {
      if (!__DEV__) {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            Alert.alert(
              "New app version available",
              "A new version is available. Restart now to update?",
              [
                { text: "Later", style: "cancel" },
                {
                  text: "Restart now",
                  onPress: () => {
                    void Updates.reloadAsync();
                  },
                },
              ],
              { cancelable: true },
            );
          }
        } catch {
          // Ignore update check errors to avoid blocking startup.
        }
      }

      const hasPermission = await requestPermissions();
      if (hasPermission) await scheduleDailyReminder();

      const profile = await getUserProfile();
      const inAuthGroup = segments[0] === "currency-setup";
      if (!profile && !inAuthGroup) {
        router.replace("/currency-setup");
      }
      setIsReady(true);
    }
    setup();
  }, [segments]);

  if (!isReady) return null;

  const navTheme = isDark
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: colors.bg,
          card: colors.card,
          text: colors.text,
          border: colors.border,
        },
      }
    : {
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
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
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
