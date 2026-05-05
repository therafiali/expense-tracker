import { requestPermissions, scheduleDailyReminder } from "@/lib/notifications";
import { getUserProfile } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { syncAll } from "@/lib/sync";
import { ThemeProvider, useTheme } from "@/lib/theme";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import "../global.css";

void SplashScreen.preventAutoHideAsync();

function RootLayoutContent() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const hasCheckedUpdate = useRef(false);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      try {
        const hasPermission = await requestPermissions();
        if (hasPermission) {
          try {
            await scheduleDailyReminder();
          } catch (e) {
            console.warn("[startup] scheduleDailyReminder failed:", e);
          }
        }

        const profile = await getUserProfile();
        const inAuthGroup = segments[0] === "currency-setup";
        if (!cancelled && !profile && !inAuthGroup) {
          router.replace("/currency-setup");
        }
      } catch (e) {
        console.error("[startup] root setup failed:", e);
      } finally {
        if (!cancelled) setIsReady(true);
      }
    }

    void setup();
    return () => {
      cancelled = true;
    };
  }, [segments]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return;
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;
      void syncAll();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isReady || __DEV__ || hasCheckedUpdate.current) return;

    hasCheckedUpdate.current = true;

    async function checkForAppUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) return;

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
      } catch {
        // Ignore update check errors to avoid blocking startup.
      }
    }

    checkForAppUpdate();
  }, [isReady]);

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
        <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        <Stack.Screen
          name="add-transaction"
          options={{
            presentation: "modal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="add-goal"
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
  /** Deep `require`s only — avoid `@expo-google-fonts/inter` index (pulls every weight and breaks Metro). */
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular: require("@expo-google-fonts/inter/400Regular/Inter_400Regular.ttf"),
    Inter_500Medium: require("@expo-google-fonts/inter/500Medium/Inter_500Medium.ttf"),
    Inter_600SemiBold: require("@expo-google-fonts/inter/600SemiBold/Inter_600SemiBold.ttf"),
    Inter_700Bold: require("@expo-google-fonts/inter/700Bold/Inter_700Bold.ttf"),
    Inter_800ExtraBold: require("@expo-google-fonts/inter/800ExtraBold/Inter_800ExtraBold.ttf"),
  });

  const fontsResolved = fontsLoaded || fontError != null;

  useEffect(() => {
    if (fontsResolved) {
      void SplashScreen.hideAsync();
    }
  }, [fontsResolved]);

  useEffect(() => {
    if (fontError) {
      console.warn("[fonts] Inter failed to load, using system fonts:", fontError);
    }
  }, [fontError]);

  if (!fontsResolved) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#EFF9FD",
        }}
      >
        <ActivityIndicator size="large" color="#2A6174" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <RootLayoutContent />
    </ThemeProvider>
  );
}
