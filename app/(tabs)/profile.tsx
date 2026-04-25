import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Switch,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  Mail,
  CreditCard,
  ChevronRight,
  RefreshCw,
  LogOut,
  LogIn,
  UserPlus,
  Cloud,
  Moon,
  Sun,
  Save,
} from 'lucide-react-native';
import { getUserProfile, saveUserProfile, UserProfile } from '@/lib/storage';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { syncAll } from '@/lib/sync';
import { Session } from '@supabase/supabase-js';
import { useTheme } from '@/lib/theme';
import { APP_VERSION } from '@/constants/version';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', email: '', currency: 'USD' });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { colors, isDark, toggleTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const data = await getUserProfile();
    if (data) setProfile(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile.name.trim()) {
      Alert.alert('Name required', 'Please enter your name.');
      return;
    }
    await saveUserProfile(profile);
    Alert.alert('Saved', 'Profile updated.');
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Email and password are required.');
      return;
    }
    try {
      if (authMode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: profile.name } },
        });
        if (error) throw error;
        Alert.alert('Check email', 'A confirmation link was sent to your email.');
      }
      setAuthMode(null);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      Alert.alert('Auth Error', err.message);
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncAll();
      Alert.alert('Synced', 'Cloud sync completed.');
    } catch {
      Alert.alert('Error', 'Sync failed. Check your connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckUpdate = async () => {
    if (__DEV__) {
      Alert.alert('Dev mode', 'Updates are not available in development mode.');
      return;
    }
    setUpdating(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert('Update available', `Version ${APP_VERSION} is ready. Install now?`, [
          { text: 'Later', style: 'cancel', onPress: () => setUpdating(false) },
          {
            text: 'Install',
            onPress: async () => {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            },
          },
        ]);
      } else {
        // Double check if there's a runtime version mismatch
        const currentVersion = Constants.expoConfig?.version;
        if (currentVersion && currentVersion !== APP_VERSION) {
          Alert.alert(
            'New version available',
            `A newer version (v${APP_VERSION}) exists, but it requires a store update. Please download the latest build.`,
            [{ text: 'OK', onPress: () => setUpdating(false) }]
          );
        } else {
          Alert.alert('Up to date', 'You are on the latest version.');
          setUpdating(false);
        }
      }
    } catch (error) {
      console.error('Update check error:', error);
      Alert.alert('Error', 'Failed to check for updates. Make sure you have a stable connection.');
      setUpdating(false);
    }
  };

  if (loading) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: isDark ? '#10B98118' : '#10B98110', borderColor: isDark ? '#10B98140' : '#10B98120' }]}>
            <User size={36} color="#10B981" />
          </View>
          <Text style={[styles.avatarName, { color: colors.text }]}>{profile.name || 'Your Name'}</Text>
          <Text style={[styles.avatarEmail, { color: colors.subtext }]}>{profile.email || 'Set your email below'}</Text>
        </View>

        {/* Personal Details */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Personal Details</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.row}>
            <User size={18} color={colors.subtext} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Full Name"
              placeholderTextColor={colors.placeholder}
              value={profile.name}
              onChangeText={(v) => setProfile({ ...profile, name: v })}
            />
          </View>
          <View style={[styles.rowDivider, { backgroundColor: colors.rowDivider }]} />
          <View style={styles.row}>
            <Mail size={18} color={colors.subtext} />
            <TextInput
              style={[styles.textInput, { color: colors.text }]}
              placeholder="Email (optional)"
              placeholderTextColor={colors.placeholder}
              value={profile.email}
              onChangeText={(v) => setProfile({ ...profile, email: v })}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Save size={16} color="#000" />
          <Text style={styles.saveBtnText}>Save Profile</Text>
        </TouchableOpacity>

        {/* Settings */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Settings</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Currency */}
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push('/currency-setup')}
            activeOpacity={0.7}
          >
            <CreditCard size={18} color={colors.subtext} />
            <Text style={[styles.rowText, { color: colors.text }]}>Currency</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{profile.currency}</Text>
              <ChevronRight size={16} color={colors.placeholder} />
            </View>
          </TouchableOpacity>
          <View style={[styles.rowDivider, { backgroundColor: colors.rowDivider }]} />
          {/* Dark / Light mode */}
          <View style={styles.row}>
            {isDark ? <Moon size={18} color={colors.subtext} /> : <Sun size={18} color="#F59E0B" />}
            <Text style={[styles.rowText, { color: colors.text }]}>{isDark ? 'Dark Mode' : 'Light Mode'}</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.placeholder, true: '#10B98150' }}
              thumbColor={isDark ? '#10B981' : '#9CA3AF'}
              style={styles.switch}
            />
          </View>
        </View>

        {/* Cloud Sync / Auth */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Cloud Sync</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {!session ? (
            authMode ? (
              <View style={styles.authForm}>
                <Text style={[styles.authTitle, { color: colors.text }]}>
                  {authMode === 'login' ? 'Sign In' : 'Create Account'}
                </Text>
                <TextInput
                  style={[styles.authInput, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <TextInput
                  style={[styles.authInput, { backgroundColor: colors.card2, color: colors.text, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
                <View style={styles.authBtns}>
                  <TouchableOpacity style={styles.authPrimaryBtn} onPress={handleAuth}>
                    <Text style={styles.authPrimaryText}>
                      {authMode === 'login' ? 'Login' : 'Sign Up'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.authSecondaryBtn} onPress={() => setAuthMode(null)}>
                    <Text style={[styles.authSecondaryText, { color: colors.muted }]}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.authPrompt}>
                <Cloud size={28} color="#10B981" />
                <Text style={[styles.authPromptText, { color: colors.subtext }]}>Sync data across devices</Text>
                <View style={styles.authPromptBtns}>
                  <TouchableOpacity style={[styles.authChip, { backgroundColor: colors.card2, borderColor: colors.border }]} onPress={() => setAuthMode('login')}>
                    <LogIn size={15} color={colors.text} />
                    <Text style={[styles.authChipText, { color: colors.text }]}>Login</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.authChip, { backgroundColor: colors.card2, borderColor: colors.border }]} onPress={() => setAuthMode('signup')}>
                    <UserPlus size={15} color={colors.text} />
                    <Text style={[styles.authChipText, { color: colors.text }]}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          ) : (
            <View>
              <View style={styles.row}>
                <Cloud size={18} color="#10B981" />
                <Text style={[styles.rowText, { color: '#10B981' }]} numberOfLines={1}>
                  {session.user.email}
                </Text>
                <TouchableOpacity onPress={handleSignOut} style={styles.rowRight}>
                  <LogOut size={18} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View style={[styles.rowDivider, { backgroundColor: colors.rowDivider }]} />
              <TouchableOpacity
                style={styles.row}
                onPress={handleSync}
                disabled={syncing}
                activeOpacity={0.7}
              >
                <RefreshCw size={18} color={colors.subtext} />
                <Text style={[styles.rowText, { color: colors.text }]}>{syncing ? 'Syncing…' : 'Sync Now'}</Text>
                {!syncing && <ChevronRight size={16} color={colors.placeholder} style={styles.rowRight} />}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* App */}
        <Text style={[styles.sectionLabel, { color: colors.muted }]}>App</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleCheckUpdate}
            disabled={updating}
            activeOpacity={0.7}
          >
            <RefreshCw size={18} color={colors.subtext} />
            <Text style={[styles.rowText, { color: colors.text }]}>Check for Updates</Text>
            <View style={styles.rowRight}>
              {updating ? (
                <Text style={styles.rowValue}>Checking…</Text>
              ) : (
                <>
                  <View style={[styles.versionBadge, { backgroundColor: colors.border }]}>
                    <View style={styles.greenDot} />
                    <Text style={[styles.versionText, { color: colors.subtext }]}>
                      v{APP_VERSION}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.placeholder} />
                </>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingTop: 28, paddingBottom: 24 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  avatarName: { fontSize: 20, fontWeight: '700' },
  avatarEmail: { fontSize: 13, marginTop: 4 },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 20,
    marginLeft: 4,
  },

  // Card
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },

  // Row (generic list item)
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
  rowText: { flex: 1, fontSize: 15, color: '#FFFFFF', fontWeight: '500' },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowValue: { fontSize: 14, color: '#10B981', fontWeight: '700' },
  switch: { marginLeft: 'auto' },

  // TextInput inside rows
  textInput: { flex: 1, fontSize: 15, color: '#FFFFFF' },

  // Save button
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 12,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#000000' },

  // Version badge
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  versionText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },

  // Auth prompt (not logged in)
  authPrompt: {
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  authPromptText: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  authPromptBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  authChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E1E1E',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  authChipText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },

  // Auth form (logging in)
  authForm: { padding: 16, gap: 12 },
  authTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  authInput: {
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
    padding: 13,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  authBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  authPrimaryBtn: {
    flex: 1,
    backgroundColor: '#10B981',
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
  },
  authPrimaryText: { fontSize: 14, fontWeight: '700', color: '#000' },
  authSecondaryBtn: { flex: 1, padding: 13, alignItems: 'center' },
  authSecondaryText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
});
