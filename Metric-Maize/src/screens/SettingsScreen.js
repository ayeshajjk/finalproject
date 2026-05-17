import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';

const SettingsScreen = ({ navigation }) => {
  const { user, deleteAccount } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      if (data) {
        setUsername(data.username || '');
      }
      setEmail(user.email || '');
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Please enter your current password');
      return;
    }
    if (!newPassword) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different from current password');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('Current password is incorrect');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      Alert.alert(
        'Success',
        'Password updated successfully!\n\nPlease use your new password for future logins.',
        [{ text: 'OK' }]
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all associated data including scan history, profile information, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Delete',
          style: 'destructive',
          onPress: () => confirmDeleteAccount(),
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setLoading(true);
    try {
      const { error } = await deleteAccount();
      if (error) throw error;
      console.log('✅ Account successfully deleted');
    } catch (error) {
      setLoading(false);
      Alert.alert(
        'Deletion Failed',
        error.message ||
        'Could not delete your account. Please try again or contact support.',
        [{ text: 'OK' }]
      );
    }
  };

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#18392B" />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#18392B" barStyle="light-content" />

      {/* ============================================================ */}
      {/* HEADER */}
      {/* ============================================================ */}
      <LinearGradient colors={['#18392B', '#14452F']} style={styles.header}>
        <View style={styles.headerContent}>
          {/* ✅ Back Button */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Settings</Text>
            <Text style={styles.headerSubtitle}>Manage your account</Text>
          </View>

          {/* Icon */}
          <View style={styles.headerIconContainer}>
            <Feather name="settings" size={24} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================================================ */}
        {/* ACCOUNT INFORMATION */}
        {/* ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Feather name="user" size={18} color="#18392B" />
            </View>
            <Text style={styles.sectionTitle}>Account Information</Text>
          </View>

          <View style={styles.card}>
            {/* Email - Read Only */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email Address</Text>
              <View style={styles.readOnlyInput}>
                <Feather name="mail" size={18} color="#9CA3AF" />
                <Text style={styles.readOnlyText} numberOfLines={1}>
                  {email}
                </Text>
                <View style={styles.verifiedBadge}>
                  <Feather name="check-circle" size={13} color="#10B981" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              <Text style={styles.inputHint}>
                Email address cannot be changed.
              </Text>
            </View>

            <View style={styles.divider} />

            {/* ✅ Username - Read Only (Cannot be updated) */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Username</Text>
              <View style={styles.readOnlyInput}>
                <Feather name="at-sign" size={18} color="#9CA3AF" />
                <Text style={styles.readOnlyText} numberOfLines={1}>
                  {username || 'No username set'}
                </Text>
                <View style={styles.lockedBadge}>
                  <Feather name="lock" size={13} color="#6B7280" />
                  <Text style={styles.lockedText}>Fixed</Text>
                </View>
              </View>
              <Text style={styles.inputHint}>
                Username cannot be changed after account creation.
              </Text>
            </View>
          </View>
        </View>

        {/* ============================================================ */}
        {/* CHANGE PASSWORD */}
        {/* ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Feather name="lock" size={18} color="#18392B" />
            </View>
            <Text style={styles.sectionTitle}>Change Password</Text>
          </View>

          <View style={styles.card}>
            {/* Current Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <View style={styles.inputContainer}>
                <Feather name="lock" size={18} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showCurrentPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                  disabled={loading}
                >
                  <Feather
                    name={showCurrentPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.divider} />

            {/* New Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <View style={styles.inputContainer}>
                <Feather name="key" size={18} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showNewPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowNewPassword(!showNewPassword)}
                  disabled={loading}
                >
                  <Feather
                    name={showNewPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              {newPassword.length > 0 && (
                <View style={styles.passwordStrength}>
                  <View
                    style={[
                      styles.strengthBar,
                      newPassword.length >= 8
                        ? styles.strengthStrong
                        : newPassword.length >= 6
                          ? styles.strengthMedium
                          : styles.strengthWeak,
                    ]}
                  />
                  <Text style={styles.strengthText}>
                    {newPassword.length >= 8
                      ? '🔒 Strong'
                      : newPassword.length >= 6
                        ? '⚡ Medium'
                        : '⚠️ Weak'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Confirm Password */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.inputContainer}>
                <Feather name="check-circle" size={18} color="#6B7280" />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter new password"
                  placeholderTextColor="#9CA3AF"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={loading}
                >
                  <Feather
                    name={showConfirmPassword ? 'eye-off' : 'eye'}
                    size={18}
                    color="#9CA3AF"
                  />
                </TouchableOpacity>
              </View>
              {confirmPassword.length > 0 && (
                <View style={styles.matchIndicator}>
                  {newPassword === confirmPassword ? (
                    <>
                      <Feather name="check-circle" size={14} color="#10B981" />
                      <Text style={styles.matchText}>Passwords match</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="x-circle" size={14} color="#EF4444" />
                      <Text style={styles.mismatchText}>
                        Passwords do not match
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Password Requirements */}
            <View style={styles.requirementsBox}>
              <Text style={styles.requirementsTitle}>
                Password Requirements
              </Text>
              {[
                {
                  label: 'At least 6 characters',
                  met: newPassword.length >= 6,
                },
                {
                  label: 'One uppercase letter (recommended)',
                  met: /[A-Z]/.test(newPassword),
                },
                {
                  label: 'One number (recommended)',
                  met: /[0-9]/.test(newPassword),
                },
              ].map((req, index) => (
                <View key={index} style={styles.requirementItem}>
                  <Feather
                    name={req.met ? 'check-circle' : 'circle'}
                    size={14}
                    color={req.met ? '#10B981' : '#D1D5DB'}
                  />
                  <Text
                    style={[
                      styles.requirementText,
                      req.met && styles.requirementMet,
                    ]}
                  >
                    {req.label}
                  </Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleUpdatePassword}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="shield" size={17} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>Update Password</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* PRIVACY */}
        {/* ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconContainer}>
              <Feather name="shield" size={18} color="#18392B" />
            </View>
            <Text style={styles.sectionTitle}>Privacy</Text>
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => navigation.navigate('Privacy')}
              disabled={loading}
            >
              <View style={styles.actionLeft}>
                <View style={[styles.actionIcon, { backgroundColor: '#FEF3C7' }]}>
                  <Feather name="shield" size={20} color="#F59E0B" />
                </View>
                <View style={styles.actionText}>
                  <Text style={styles.actionTitle}>Privacy Settings</Text>
                  <Text style={styles.actionDescription}>
                    Manage your data and privacy preferences
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* DELETE ACCOUNT */}
        {/* ============================================================ */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIconContainer, { backgroundColor: '#FEE2E2' }]}>
              <Feather name="trash-2" size={18} color="#EF4444" />
            </View>
            <Text style={[styles.sectionTitle, { color: '#EF4444' }]}>
              Delete Account
            </Text>
          </View>

          <View style={styles.deleteCard}>
            {/* Warning Banner */}
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={22} color="#DC2626" />
              <Text style={styles.warningBannerText}>Irreversible Action</Text>
            </View>

            {/* What will be deleted */}
            <Text style={styles.deleteCardTitle}>
              The following data will be permanently removed:
            </Text>

            {[
              { icon: 'user', text: 'Profile and account information' },
              { icon: 'clock', text: 'All scan history and results' },
              { icon: 'image', text: 'All stored images and data' },
              { icon: 'settings', text: 'Preferences and settings' },
            ].map((item, index) => (
              <View key={index} style={styles.deleteListItem}>
                <View style={styles.deleteListIcon}>
                  <Feather name={item.icon} size={15} color="#DC2626" />
                </View>
                <Text style={styles.deleteListText}>{item.text}</Text>
              </View>
            ))}

            <View style={styles.deleteDivider} />

            {/* Final Warning */}
            <View style={styles.finalWarning}>
              <Feather name="alert-triangle" size={16} color="#92400E" />
              <Text style={styles.finalWarningText}>
                Once deleted, your account cannot be recovered. Please make
                sure you want to proceed before continuing.
              </Text>
            </View>

            {/* Delete Button */}
            <TouchableOpacity
              style={[styles.deleteButton, loading && styles.buttonDisabled]}
              onPress={handleDeleteAccount}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="trash-2" size={18} color="#FFFFFF" />
                  <Text style={styles.deleteButtonText}>
                    Delete My Account Permanently
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ============================================================ */}
        {/* INFO FOOTER */}
        {/* ============================================================ */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <Feather name="info" size={20} color="#6366F1" />
          </View>
          <Text style={styles.infoText}>
            Your data is encrypted and stored securely. For account issues,
            contact us at{' '}
            <Text style={styles.infoEmail}>maizemetric2026@gmail.com</Text>
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  // ✅ Header
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // ✅ Back Button
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 3,
  },
  headerIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },

  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingBottom: 20,
  },

  // Section
  section: {
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  sectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18392B',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },

  // Input
  inputGroup: {
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    padding: 0,
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  readOnlyText: {
    flex: 1,
    fontSize: 15,
    color: '#6B7280',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },

  // ✅ Locked Badge for Username
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  inputHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 6,
    marginLeft: 2,
  },

  // Password
  passwordStrength: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  strengthBar: {
    height: 4,
    flex: 1,
    borderRadius: 2,
  },
  strengthWeak: { backgroundColor: '#EF4444' },
  strengthMedium: { backgroundColor: '#F59E0B' },
  strengthStrong: { backgroundColor: '#10B981' },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    width: 75,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  matchText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  mismatchText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  requirementsBox: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  requirementMet: {
    color: '#059669',
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 20,
  },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#18392B',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 20,
    gap: 8,
    shadowColor: '#18392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // Action Items
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionText: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 3,
  },
  actionDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },

  // Delete Account Card
  deleteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: '#FECACA',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 16,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 20,
    gap: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  warningBannerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  deleteCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 14,
  },
  deleteListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  deleteListIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteListText: {
    fontSize: 14,
    color: '#4B5563',
    flex: 1,
  },
  deleteDivider: {
    height: 1,
    backgroundColor: '#FEE2E2',
    marginVertical: 16,
  },
  finalWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  finalWarningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 19,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },

  // Info Footer
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#EEF2FF',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  infoIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#E0E7FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#4338CA',
    lineHeight: 19,
  },
  infoEmail: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});

export default SettingsScreen;