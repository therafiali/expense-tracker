import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, ArrowUpRight, BarChart3, History, Settings } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInUp } from 'react-native-reanimated';

export function ActionDock() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const actions = [
    { 
      id: 'income', 
      icon: ArrowUpRight, 
      label: 'Income', 
      color: '#10B981', 
      onPress: () => router.push('/add-income') 
    },
    { 
      id: 'reports', 
      icon: BarChart3, 
      label: 'Stats', 
      color: '#0EA5E9', 
      onPress: () => router.push('/reports') 
    },
    { 
      id: 'expense', 
      icon: Plus, 
      label: 'Add', 
      color: '#FFFFFF', 
      isPrimary: true,
      onPress: () => router.push('/add-expense') 
    },
    { 
      id: 'history', 
      icon: History, 
      label: 'History', 
      color: '#F59E0B', 
      onPress: () => console.log('History clicked') 
    },
    { 
      id: 'settings', 
      icon: Settings, 
      label: 'More', 
      color: '#9CA3AF', 
      onPress: () => console.log('Settings clicked') 
    },
  ];

  return (
    <Animated.View 
      entering={FadeInUp.delay(500)}
      style={[
        styles.container, 
        { bottom: Math.max(insets.bottom, 16) + 24 }
      ]}
    >
      <View style={styles.dockWrapper}>
        <BlurView intensity={30} tint="dark" style={styles.blurContainer}>
          <View style={styles.innerContainer}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                onPress={action.onPress}
                style={styles.actionButton}
                activeOpacity={0.7}
              >
                <View 
                  style={[
                    styles.iconWrapper, 
                    action.isPrimary && styles.primaryIconWrapper,
                    { backgroundColor: action.isPrimary ? '#10B981' : 'transparent' }
                  ]}
                >
                  <action.icon 
                    size={action.isPrimary ? 28 : 22} 
                    color={action.isPrimary ? '#000000' : action.color} 
                  />
                </View>
                {!action.isPrimary && (
                  <Text style={[styles.label, { color: action.color }]}>{action.label}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </BlurView>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 100,
  },
  dockWrapper: {
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(26, 26, 26, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  blurContainer: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  innerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 50,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryIconWrapper: {
    width: 54,
    height: 54,
    borderRadius: 27,
    marginTop: -20, // Pop up effect
    borderWidth: 4,
    borderColor: '#121212',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 4,
  },
});
