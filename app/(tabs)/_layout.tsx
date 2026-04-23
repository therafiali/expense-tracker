import { Tabs } from 'expo-router';
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, BarChart2, PlusCircle, FileText, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, usePathname } from 'expo-router';
import { useTheme } from '@/lib/theme';

function CustomTabBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();

  const tabs = [
    { name: 'Home', icon: Home, route: '/(tabs)/' },
    { name: 'Charts', icon: BarChart2, route: '/(tabs)/charts' },
    { name: null, icon: PlusCircle, route: '/add-transaction', isAdd: true },
    { name: 'Reports', icon: FileText, route: '/(tabs)/reports' },
    { name: 'Profile', icon: User, route: '/(tabs)/profile' },
  ];

  const isActive = (route: string) => {
    if (route === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)/';
    const segment = route.replace('/(tabs)/', '');
    return pathname === `/${segment}` || pathname === `/(tabs)/${segment}`;
  };

  return (
    <View style={[
      styles.tabBar, 
      { 
        paddingBottom: Math.max(insets.bottom, 8),
        backgroundColor: colors.tabBar,
        borderTopColor: colors.tabBorder,
      }
    ]}>
      {tabs.map((tab, index) => {
        const active = !tab.isAdd && isActive(tab.route);
        const Icon = tab.icon;

        if (tab.isAdd) {
          return (
            <TouchableOpacity
              key="add"
              style={styles.addButton}
              onPress={() => router.push('/add-transaction' as any)}
              activeOpacity={0.85}
            >
              <View style={styles.addButtonInner}>
                <Icon size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={tab.name || index}
            style={styles.tabItem}
            onPress={() => router.push(tab.route as any)}
            activeOpacity={0.7}
          >
            <Icon
              size={22}
              color={active ? '#10B981' : colors.tabInactive}
              strokeWidth={active ? 2.5 : 2}
            />
            <Text style={[
              styles.tabLabel, 
              { color: active ? '#10B981' : colors.tabInactive },
              active && styles.tabLabelActive
            ]}>
              {tab.name}
            </Text>
          </TouchableOpacity>
        );
      })}
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
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 10,
    paddingHorizontal: 8,
    alignItems: 'flex-end',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingBottom: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  addButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -24,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
});
