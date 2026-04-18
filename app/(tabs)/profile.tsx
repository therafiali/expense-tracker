import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Mail, CreditCard, ChevronRight, Save } from 'lucide-react-native';
import { getUserProfile, saveUserProfile, UserProfile } from '@/lib/storage';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { RefreshCw, Download, Info } from 'lucide-react-native';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>({ name: '', email: '', currency: 'USD' });
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const data = await getUserProfile();
    if (data) {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!profile.name) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    await saveUserProfile(profile);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleCheckUpdate = async () => {
    if (__DEV__) {
      Alert.alert('Notice', 'Updates are not available in development mode.');
      return;
    }

    setUpdating(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        Alert.alert(
          'Update Available',
          'A new version of WalletWatch is available. Download and install now?',
          [
            { text: 'Later', style: 'cancel', onPress: () => setUpdating(false) },
            { 
              text: 'Update', 
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              }
            }
          ]
        );
      } else {
        Alert.alert('Up to Date', 'You are already using the latest version.');
        setUpdating(false);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check for updates. Please try again later.');
      setUpdating(false);
    }
  };

  if (loading) return null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarPlaceholder}>
            <User size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>{profile.name || 'User'}</Text>
          <Text style={styles.subtitle}>{profile.email || 'Complete your profile'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <View style={styles.card}>
            <View style={styles.inputGroup}>
              <User size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#6B7280"
                value={profile.name}
                onChangeText={(text) => setProfile({ ...profile, name: text })}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.inputGroup}>
              <Mail size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Email Address (Optional)"
                placeholderTextColor="#6B7280"
                value={profile.email}
                onChangeText={(text) => setProfile({ ...profile, email: text })}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>Preferences</Text>
          <TouchableOpacity 
            style={styles.card}
            onPress={() => router.push('/currency-setup')}
          >
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLabel}>
                <CreditCard size={20} color="#9CA3AF" />
                <Text style={styles.preferenceText}>Currency</Text>
              </View>
              <View style={styles.preferenceValue}>
                <Text style={styles.currencyCode}>{profile.currency}</Text>
                <ChevronRight size={20} color="#4B5563" />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>App</Text>
          <TouchableOpacity 
            style={styles.card}
            onPress={handleCheckUpdate}
            disabled={updating}
          >
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceLabel}>
                <RefreshCw size={20} color="#9CA3AF" />
                <Text style={styles.preferenceText}>Check for Updates</Text>
              </View>
              <View style={styles.preferenceValue}>
                {updating ? (
                  <Text style={styles.updatingText}>Checking...</Text>
                ) : (
                  <>
                    <Text style={styles.versionText}>v1.0.0</Text>
                    <ChevronRight size={20} color="#4B5563" />
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Save size={20} color="#000000" />
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F0F',
  },
  content: {
    padding: 24,
    paddingBottom: 120, // Space for ActionDock
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 16,
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  preferenceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  preferenceValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currencyCode: {
    fontSize: 16,
    color: '#10B981',
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 16,
    gap: 12,
  },
  saveButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  versionText: {
    fontSize: 14,
    color: '#4B5563',
  },
  updatingText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '600',
  },
});
