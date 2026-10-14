import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';
import { radii } from '@/constants/designTokens';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setHasSession(!!data.session);
      setChecking(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
      setChecking(false);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdate = async () => {
    if (password.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Passwords do not match', 'Type the same password in both fields.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Password updated', 'You are signed in with your new password.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/profile') },
      ]);
    } catch (err: any) {
      Alert.alert('Could not update password', err.message ?? 'Try requesting a new reset email.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Choose a new password</Text>
        {checking ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !hasSession ? (
          <>
            <Text style={[styles.hint, { color: colors.subtext }]}>
              This reset link is missing or expired. Request a new one from Profile.
            </Text>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.replace('/(tabs)/profile')}
            >
              <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Go to Profile</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={[styles.hint, { color: colors.subtext }]}>
              Enter a new password for your account.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
              placeholder="New password"
              placeholderTextColor={colors.placeholder}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm password"
              placeholderTextColor={colors.placeholder}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              onPress={handleUpdate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>Update password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 32, gap: 12 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  spinner: { marginTop: 24 },
  input: {
    borderRadius: 10,
    padding: 13,
    fontSize: 14,
    borderWidth: 1,
  },
  primaryBtn: {
    borderRadius: radii.md,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryText: { fontSize: 15, fontWeight: '700' },
});
