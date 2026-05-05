import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, BarChart2, Plus, FileText, User, Menu } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/lib/theme';
import { Fonts } from '@/constants/fonts';
import { chartGradients } from '@/constants/designTokens';

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const tabs = [
    { name: 'Home', icon: Home, route: '/(tabs)/' },
    { name: 'Charts', icon: BarChart2, route: '/(tabs)/charts' },
    { name: 'Reports', icon: FileText, route: '/(tabs)/reports' },
    // { name: 'Profile', icon: User, route: '/(tabs)/profile' },
  ];

  const isActive = (route: string) => {
    if (route === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)/';
    const segment = route.replace('/(tabs)/', '');
    return pathname === `/${segment}` || pathname === `/(tabs)/${segment}`;
  };

  const pillShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: colors.isDark ? 0.35 : 0.08,
          shadowRadius: 16,
        }
      : { elevation: 6 };

  const fabShadow =
    Platform.OS === 'ios'
      ? {
          shadowColor: colors.fabShadow,
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.35,
          shadowRadius: 10,
        }
      : { elevation: 10 };

  return (
    <View
      style={[
        styles.barWrap,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          backgroundColor: colors.bg,
        },
      ]}
    >

      <View style={[styles.pill, { backgroundColor: colors.card }, pillShadow]}>
        {tabs.map((tab) => {
          const active = isActive(tab.route);
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.pillTab}
              onPress={() => router.push(tab.route as any)}
              activeOpacity={0.75}
            >
              <Icon
                size={21}
                color={active ? colors.tabActive : colors.tabInactive}
                strokeWidth={active ? 2.5 : 2}
              />
              <Text
                style={[
                  styles.pillLabel,
                  {
                    fontFamily: Fonts.semibold,
                    color: active ? colors.tabActive : colors.tabInactive,
                  },
                  active && styles.pillLabelActive,
                ]}
                numberOfLines={1}
              >
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[styles.fabOuter, fabShadow]}
        onPress={() => router.push('/add-transaction')}
        activeOpacity={0.88}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
      >
        <LinearGradient
          colors={[...chartGradients.fab]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={styles.fabGradient}
        >
          <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="charts" />
        <Tabs.Screen name="explore" options={{ href: null }} />
        <Tabs.Screen name="reports" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <CustomTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  barWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    gap: 10,
  },
  menuBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 4,
    minHeight: 58,
  },
  pillTab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
    minWidth: 52,
  },
  pillLabel: {
    fontSize: 10,
    letterSpacing: -0.2,
  },
  pillLabelActive: {
    fontWeight: '700',
  },
  fabOuter: {
    borderRadius: 29,
    overflow: 'hidden',
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
