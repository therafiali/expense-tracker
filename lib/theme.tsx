import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  palette,
  incomeLight,
  incomeDark,
  withAlpha,
} from '@/constants/designTokens';

export interface ThemeColors {
  bg: string;
  card: string;
  card2: string;
  card3: string;
  text: string;
  subtext: string;
  muted: string;
  border: string;
  border2: string;
  tabBar: string;
  tabBorder: string;
  tabInactive: string;
  placeholder: string;
  inputBg: string;
  rowDivider: string;
  primary: string;
  primaryForeground: string;
  primaryMuted: string;
  income: string;
  expense: string;
  expenseMuted: string;
  heading: string;
  tabActive: string;
  fabShadow: string;
  isDark: boolean;
}

export const DARK: ThemeColors = {
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
  primary: palette.primary,
  primaryForeground: palette.onPrimary,
  primaryMuted: withAlpha(palette.primary, '33'),
  income: incomeDark,
  expense: palette.expense,
  expenseMuted: withAlpha(palette.expense, '33'),
  heading: palette.primaryDark,
  tabActive: palette.primary,
  fabShadow: palette.primary,
  isDark: true,
};

export const LIGHT: ThemeColors = {
  bg: '#EFF9FD',
  card: '#FFFFFF',
  card2: '#F5FCFE',
  card3: '#E8F4FA',
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
  primary: palette.primary,
  primaryForeground: palette.onPrimary,
  primaryMuted: withAlpha(palette.primary, '55'),
  income: incomeLight,
  expense: palette.expense,
  expenseMuted: withAlpha(palette.expense, '33'),
  heading: palette.primaryDark,
  tabActive: palette.primaryDark,
  fabShadow: palette.primaryDark,
  isDark: false,
};

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
