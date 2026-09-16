import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, AlertCircle, AlertTriangle, Info } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { TOAST_SHOW_EVENT, type ToastPayload, type ToastType } from '@/lib/toast';

const AUTO_DISMISS_MS = 12_000;

function iconForType(type: ToastType, color: string) {
  const size = 18;
  if (type === 'warning') return <AlertTriangle size={size} color={color} />;
  if (type === 'info') return <Info size={size} color={color} />;
  return <AlertCircle size={size} color={color} />;
}

function accentForType(type: ToastType) {
  if (type === 'warning') return '#F59E0B';
  if (type === 'info') return '#3B82F6';
  return '#EF4444';
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimer.current) {
      clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    }
  }, []);

  const hideToast = useCallback(() => {
    clearDismissTimer();
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 16, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [clearDismissTimer, opacity, translateY]);

  const showToastUi = useCallback(
    (payload: ToastPayload) => {
      clearDismissTimer();
      setToast(payload);
      opacity.setValue(0);
      translateY.setValue(16);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
      dismissTimer.current = setTimeout(() => {
        hideToast();
      }, AUTO_DISMISS_MS);
    },
    [clearDismissTimer, hideToast, opacity, translateY],
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(TOAST_SHOW_EVENT, (payload: ToastPayload) => {
      showToastUi(payload);
    });
    return () => {
      sub.remove();
      clearDismissTimer();
    };
  }, [clearDismissTimer, showToastUi]);

  if (!toast) return null;

  const accent = accentForType(toast.type);

  return (
    <View pointerEvents="box-none" style={[styles.host, { paddingBottom: Math.max(insets.bottom, 12) + 72 }]}>
      <Animated.View
        style={[
          styles.toast,
          {
            opacity,
            transform: [{ translateY }],
            backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF',
            borderColor: isDark ? `${accent}55` : `${accent}33`,
            shadowColor: isDark ? '#000' : '#64748B',
          },
        ]}
      >
        <View style={[styles.accent, { backgroundColor: accent }]} />
        <View style={styles.iconWrap}>{iconForType(toast.type, accent)}</View>
        <Text style={[styles.message, { color: colors.text }]} accessibilityRole="alert">
          {toast.message}
        </Text>
        <Pressable
          onPress={hideToast}
          hitSlop={10}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.closeBtnPressed]}
          accessibilityLabel="Dismiss message"
          accessibilityRole="button"
        >
          <X size={18} color={colors.muted} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    zIndex: 9999,
    elevation: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingRight: 10,
    paddingLeft: 0,
    gap: 10,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  iconWrap: {
    paddingTop: 1,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  closeBtn: {
    padding: 4,
    marginTop: -2,
  },
  closeBtnPressed: {
    opacity: 0.65,
  },
});
