import { DeviceEventEmitter } from 'react-native';

export type ToastType = 'error' | 'warning' | 'info';

export const TOAST_SHOW_EVENT = 'aco_toast_show';

export type ToastPayload = {
  id: string;
  message: string;
  type: ToastType;
};

export function showToast(message: string, type: ToastType = 'error') {
  const trimmed = message.trim();
  if (!trimmed) return;
  DeviceEventEmitter.emit(TOAST_SHOW_EVENT, {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    message: trimmed,
    type,
  } satisfies ToastPayload);
}

export function formatSupabaseError(error: { message?: string } | null | undefined): string {
  return error?.message?.trim() || 'Something went wrong';
}

let lastOfflineWarningAt = 0;
const OFFLINE_WARNING_COOLDOWN_MS = 45_000;

/** Shown when a cloud write runs without a signed-in session (debounced). */
export function showOfflineSyncWarning() {
  const now = Date.now();
  if (now - lastOfflineWarningAt < OFFLINE_WARNING_COOLDOWN_MS) return;
  lastOfflineWarningAt = now;
  showToast('Saved on this device only. Sign in to sync to the cloud.', 'warning');
}
