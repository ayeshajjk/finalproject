import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import * as Notifications from 'expo-notifications';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const NotificationsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [notifications, setNotifications] = useState({
    scanCompletion: true,
    appUpdates: true,
    pushNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
  });

  useEffect(() => {
    if (user) {
      loadNotificationSettings();
      requestNotificationPermissions();
    } else {
      setLoading(false);
    }
  }, [user]);

  const requestNotificationPermissions = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('Notification permissions not granted');
        // Update push notifications to false if permission denied
        setNotifications(prev => ({ ...prev, pushNotifications: false }));
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const loadNotificationSettings = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        setNotifications({
          scanCompletion: data.scan_completion ?? true,
          appUpdates: data.app_updates ?? true,
          pushNotifications: data.push_notifications ?? true,
          soundEnabled: data.sound_enabled ?? true,
          vibrationEnabled: data.vibration_enabled ?? true,
        });
      } else {
        // No settings found, create default settings
        await createDefaultSettings();
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
      if (Platform.OS === 'web') {
        alert('Failed to load notification settings');
      } else {
        Alert.alert('Error', 'Failed to load notification settings');
      }
    } finally {
      setLoading(false);
    }
  };

  const createDefaultSettings = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_settings')
        .insert({
          user_id: user.id,
          scan_completion: true,
          app_updates: true,
          push_notifications: true,
          sound_enabled: true,
          vibration_enabled: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error creating default settings:', error);
    }
  };

  const handleToggle = async (key, value) => {
    // If enabling push notifications, check permissions first
    if (key === 'pushNotifications' && value) {
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        
        if (newStatus !== 'granted') {
          if (Platform.OS === 'web') {
            alert('Please enable notifications in your browser settings');
          } else {
            Alert.alert(
              'Permission Required',
              'Please enable notifications in your device settings to receive push notifications.',
              [{ text: 'OK' }]
            );
          }
          return;
        }
      }
    }

    // If disabling push notifications, show confirmation
    if (key === 'pushNotifications' && !value) {
      const confirmDisable = Platform.OS === 'web'
        ? window.confirm('You will not receive any notifications. You can re-enable this anytime in settings.')
        : await new Promise((resolve) => {
            Alert.alert(
              'Disable Push Notifications',
              'You will not receive any notifications. You can re-enable this anytime in settings.',
              [
                { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Disable', style: 'destructive', onPress: () => resolve(true) },
              ]
            );
          });

      if (!confirmDisable) return;
    }

    updateSetting(key, value);
  };

  const updateSetting = async (key, value) => {
    if (!user) {
      if (Platform.OS === 'web') {
        alert('User not logged in');
      } else {
        Alert.alert('Error', 'User not logged in');
      }
      return;
    }

    // Optimistically update UI
    const newSettings = { ...notifications, [key]: value };
    setNotifications(newSettings);
    setSaving(true);

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          scan_completion: newSettings.scanCompletion,
          app_updates: newSettings.appUpdates,
          push_notifications: newSettings.pushNotifications,
          sound_enabled: newSettings.soundEnabled,
          vibration_enabled: newSettings.vibrationEnabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Show success feedback
      console.log('Notification settings saved successfully');
      
    } catch (error) {
      console.error('Error saving notification settings:', error);
      
      // Revert changes on error
      setNotifications(notifications);
      
      if (Platform.OS === 'web') {
        alert('Failed to update notification settings');
      } else {
        Alert.alert('Error', 'Failed to update notification settings. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDisableAll = () => {
    const confirmAction = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to turn off all notifications?')
      : new Promise((resolve) => {
          Alert.alert(
            'Disable All Notifications',
            'Are you sure you want to turn off all notifications?',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Disable All', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (Platform.OS === 'web') {
      if (confirmAction) {
        disableAllNotifications();
      }
    } else {
      confirmAction.then((shouldDisable) => {
        if (shouldDisable) {
          disableAllNotifications();
        }
      });
    }
  };

  const disableAllNotifications = async () => {
    const disabledSettings = {
      scanCompletion: false,
      appUpdates: false,
      pushNotifications: false,
      soundEnabled: false,
      vibrationEnabled: false,
    };
    
    setNotifications(disabledSettings);
    setSaving(true);
    
    await saveAllSettings(disabledSettings);
  };

  const saveAllSettings = async (settings) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({
          user_id: user.id,
          scan_completion: settings.scanCompletion,
          app_updates: settings.appUpdates,
          push_notifications: settings.pushNotifications,
          sound_enabled: settings.soundEnabled,
          vibration_enabled: settings.vibrationEnabled,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      console.log('All notification settings updated successfully');
      
    } catch (error) {
      console.error('Error saving all settings:', error);
      
      if (Platform.OS === 'web') {
        alert('Failed to update notification settings');
      } else {
        Alert.alert('Error', 'Failed to update notification settings. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Profile');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
        <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.header}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Notifications</Text>
              <Text style={styles.headerSubtitle}>Manage your alerts</Text>
            </View>
            <View style={styles.headerIconContainer}>
              <Feather name="bell" size={28} color="#FFFFFF" />
            </View>
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#3B82F6" />
      
      {/* Saving Indicator */}
      {saving && (
        <View style={styles.savingIndicator}>
          <ActivityIndicator size="small" color="#3B82F6" />
          <Text style={styles.savingText}>Saving...</Text>
        </View>
      )}
      
      <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Notifications</Text>
            <Text style={styles.headerSubtitle}>Manage your alerts</Text>
          </View>
          <TouchableOpacity onPress={handleDisableAll} style={styles.headerIconContainer}>
            <Feather name="bell-off" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={['#3B82F6', '#2563EB']} style={styles.banner}>
          <Feather name="bell" size={48} color="#FFFFFF" />
          <Text style={styles.bannerTitle}>Stay Updated</Text>
          <Text style={styles.bannerSubtitle}>
            Choose what notifications you'd like to receive
          </Text>
        </LinearGradient>

        {/* Scan Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scan Activity</Text>
          <View style={styles.card}>
            <NotificationToggle
              icon="check-circle"
              iconColor="#10B981"
              title="Scan Completion"
              description="Get notified when your scans are complete"
              value={notifications.scanCompletion}
              onValueChange={(value) => handleToggle('scanCompletion', value)}
              disabled={saving}
            />
          </View>
        </View>

        {/* App Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Updates</Text>
          <View style={styles.card}>
            <NotificationToggle
              icon="download"
              iconColor="#3B82F6"
              title="App Updates"
              description="New features and improvements"
              value={notifications.appUpdates}
              onValueChange={(value) => handleToggle('appUpdates', value)}
              disabled={saving}
            />
          </View>
        </View>

        {/* Delivery Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Method</Text>
          <View style={styles.card}>
            <NotificationToggle
              icon="smartphone"
              iconColor="#10B981"
              title="Push Notifications"
              description="Receive notifications on your device"
              value={notifications.pushNotifications}
              onValueChange={(value) => handleToggle('pushNotifications', value)}
              disabled={saving}
            />
          </View>
        </View>

        {/* Sound & Vibration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Settings</Text>
          <View style={styles.card}>
            <NotificationToggle
              icon="volume-2"
              iconColor="#6366F1"
              title="Sound"
              description="Play sound for notifications"
              value={notifications.soundEnabled}
              onValueChange={(value) => handleToggle('soundEnabled', value)}
              disabled={saving}
            />
            <View style={styles.divider} />
            <NotificationToggle
              icon="smartphone"
              iconColor="#EC4899"
              title="Vibration"
              description="Vibrate for notifications"
              value={notifications.vibrationEnabled}
              onValueChange={(value) => handleToggle('vibrationEnabled', value)}
              disabled={saving}
            />
          </View>
        </View>

        <View style={styles.infoCard}>
          <Feather name="info" size={20} color="#3B82F6" />
          <Text style={styles.infoText}>
            You can customize your notification preferences at any time. Changes are saved automatically.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const NotificationToggle = ({ icon, iconColor, title, description, value, onValueChange, disabled }) => (
  <View style={[styles.toggleItem, disabled && styles.toggleItemDisabled]}>
    <View style={styles.toggleLeft}>
      <View style={[styles.toggleIcon, { backgroundColor: `${iconColor}15` }]}>
        <Feather name={icon} size={22} color={iconColor} />
      </View>
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: '#D1D5DB', true: '#10B981' }}
      thumbColor={value ? '#FFFFFF' : '#F3F4F6'}
      ios_backgroundColor="#D1D5DB"
    />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  savingIndicator: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: '#3B82F6',
    fontWeight: '600',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '400',
  },
  headerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  banner: {
    marginHorizontal: 20,
    marginTop: 24,
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  toggleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleItemDisabled: {
    opacity: 0.6,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  toggleIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  toggleDescription: {
    fontSize: 13,
    color: '#9CA3AF',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 82,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
});

export default NotificationsScreen;