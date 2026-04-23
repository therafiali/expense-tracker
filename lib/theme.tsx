import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DARK = {
  bg: '#0F0F0F',
  card: '#161616',
  card2: '#1A1A1A',
  card3: '#1E1E1E',
  text: '#FFFFFF',
  subtext: '#9CA3AF',
  muted: '#6B7280',
  border: 'rgba(255,255,255,0.06)',
  border2: 'rgba(255,255,255,0.04)',
  tabBar: '#141414',
  tabBorder: 'rgba(255,255,255,0.07)',
  tabInactive: '#6B7280',
  placeholder: '#374151',
  inputBg: '#1A1A1A',
  rowDivider: 'rgba(255,255,255,0.05)',
  isDark: true,
};

export const LIGHT = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  card2: '#F9F9F9',
  card3: '#EFEFEF',
  text: '#000000',
  subtext: '#3C3C43',
  muted: '#8E8E93',
  border: 'rgba(0,0,0,0.08)',
  border2: 'rgba(0,0,0,0.04)',
  tabBar: '#FFFFFF',
  tabBorder: 'rgba(0,0,0,0.1)',
  tabInactive: '#8E8E93',
  placeholder: '#AEAEB2',
  inputBg: '#FFFFFF',
  rowDivider: 'rgba(0,0,0,0.06)',
  isDark: false,
};

export type ThemeColors = typeof DARK;

interface ThemeContextType {
  colors: ThemeColors;
  isDark: boolean;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  colors: DARK,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((val) => {
      if (val === 'light') setIsDark(false);
    });
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem('theme_mode', next ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ colors: isDark ? DARK : LIGHT, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
