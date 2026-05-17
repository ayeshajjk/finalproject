import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../config/supabase';

const EditProfileScreen = ({ navigation }) => {
  const { user, profile, refreshProfile } = useAuth(); // ✅ Added profile
  const { theme, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [nickname, setNickname] = useState('');
  const [username, setUsername] = useState('');
  const [originalNickname, setOriginalNickname] = useState(''); // ✅ Track original value

  useEffect(() => {
    if (user) {
      loadProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  // ✅ Reset saved state when nickname changes
  useEffect(() => {
    if (saved) {
      setSaved(false);
    }
  }, [nickname]);

  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error loading profile:', error);
        if (error.code === 'PGRST116') {
          setUsername(user.email?.split('@')[0] || '');
          setNickname('');
          setOriginalNickname(''); // ✅ Set original
        }
      } else if (data) {
        const loadedNickname = data.nickname || '';
        setNickname(loadedNickname);
        setOriginalNickname(loadedNickname); // ✅ Set original
        setUsername(data.username || user.email?.split('@')[0] || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (!nickname.trim()) {
      Alert.alert('Error', 'Please enter a nickname');
      return;
    }

    setSaving(true);
    setSaved(false);

    try {
      const profileData = {
        id: user.id,
        email: user.email,
        nickname: nickname.trim(),
        username: username.trim() || user.email?.split('@')[0] || 'user',
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileData, { 
          onConflict: 'id' 
        })
        .select()
        .single(); // ✅ Added .single() to get the updated record

      if (error) throw error;

      console.log('✅ Profile updated successfully:', data);

      // ✅ Update original nickname to new value
      setOriginalNickname(nickname.trim());

      // ✅ REFRESH THE GLOBAL PROFILE STATE
      await refreshProfile();

      // ✅ Show saved state immediately
      setSaved(true);

      // ✅ Optional: Navigate back after showing "Saved!" message
      setTimeout(() => {
        navigation.goBack();
      }, 1000);

    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Settings');
    }
  };

  // ✅ Check if nickname has changed
  const hasChanged = nickname.trim() !== originalNickname.trim();
  const isButtonDisabled = !hasChanged || saving || saved || !nickname.trim();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.primary} />
        <LinearGradient
          colors={theme.gradientPrimary}
          style={styles.headerGradient}
        >
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
              <Feather name="arrow-left" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Edit Profile</Text>
              <Text style={styles.headerSubtitle}>Customize your profile</Text>
            </View>
            <View style={{ width: 44 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={theme.statusBarStyle} backgroundColor={theme.primary} />
      
      <LinearGradient
        colors={theme.gradientPrimary}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Text style={styles.headerSubtitle}>Customize your profile</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Avatar Preview */}
        <View style={[styles.avatarSection, { backgroundColor: theme.surface }]}>
          <LinearGradient
            colors={theme.gradientPrimary}
            style={styles.avatarGradient}
          >
            <View style={[styles.avatar, { backgroundColor: theme.headerBackground }]}>
              <Text style={styles.avatarText}>
                {nickname ? nickname.substring(0, 2).toUpperCase() : 'MM'}
              </Text>
            </View>
          </LinearGradient>
          <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
            Your avatar will display your nickname initials
          </Text>
        </View>

        {/* Display Information */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Display Information</Text>
          
          <View style={[styles.card, { backgroundColor: theme.surface }]}>
            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Feather name="user" size={20} color={theme.primary} />
                <Text style={[styles.inputLabel, { color: theme.text }]}>Nickname</Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBackground,
                    borderColor: hasChanged ? theme.primary : theme.inputBorder, // ✅ Green border when changed
                    color: theme.text,
                  }
                ]}
                value={nickname}
                onChangeText={setNickname}
                placeholder="Enter your nickname"
                placeholderTextColor={theme.inputPlaceholder}
                maxLength={20}
              />
              <Text style={[styles.inputHint, { color: theme.textTertiary }]}>
                This will be displayed on your profile
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Feather name="at-sign" size={20} color={theme.accent} />
                <Text style={[styles.inputLabel, { color: theme.text }]}>Username</Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.disabledInput,
                  {
                    backgroundColor: theme.borderLight,
                    borderColor: theme.inputBorder,
                    color: theme.textTertiary,
                  }
                ]}
                value={username}
                editable={false}
                placeholderTextColor={theme.inputPlaceholder}
              />
              <Text style={[styles.inputHint, { color: theme.textTertiary }]}>
                Username cannot be changed
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

            <View style={styles.inputGroup}>
              <View style={styles.inputLabelRow}>
                <Feather name="mail" size={20} color={theme.warning} />
                <Text style={[styles.inputLabel, { color: theme.text }]}>Email</Text>
              </View>
              <TextInput
                style={[
                  styles.input,
                  styles.disabledInput,
                  {
                    backgroundColor: theme.borderLight,
                    borderColor: theme.inputBorder,
                    color: theme.textTertiary,
                  }
                ]}
                value={user?.email}
                editable={false}
                placeholderTextColor={theme.inputPlaceholder}
              />
              <Text style={[styles.inputHint, { color: theme.textTertiary }]}>
                Email address is managed through settings
              </Text>
            </View>
          </View>
        </View>

        {/* Info Card */}
        <View style={[
          styles.infoCard,
          { backgroundColor: isDarkMode ? '#065F4620' : '#D1FAE5' }
        ]}>
          <Feather name="info" size={20} color={theme.primary} />
          <Text style={[styles.infoText, { color: isDarkMode ? theme.primary : '#065F46' }]}>
            Your nickname will be visible across the app. Choose something that represents you!
          </Text>
        </View>

        {/* Save Button - ✅ Updated with dynamic colors and states */}
        <TouchableOpacity
          style={[
            styles.saveButton, 
            isButtonDisabled && styles.saveButtonDisabled
          ]}
          onPress={handleSave}
          disabled={isButtonDisabled}
        >
          <LinearGradient
            colors={
              saved 
                ? ['#10B981', '#059669'] // ✅ Green when saved
                : hasChanged && !saving
                ? theme.gradientPrimary // ✅ Green when changed
                : ['#9CA3AF', '#6B7280'] // ✅ Gray when no changes or saving
            }
            style={styles.saveButtonGradient}
          >
            {saving ? (
              <>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Saving...</Text>
              </>
            ) : saved ? (
              <>
                <Feather name="check-circle" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Saved!</Text>
              </>
            ) : (
              <>
                <Feather name={hasChanged ? "check" : "save"} size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>
                  {hasChanged ? 'Save Changes' : 'Change'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerGradient: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#10B981',
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
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 2,
  },
  avatarGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
    marginBottom: 12,
  },
  avatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  avatarHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 4,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2, // ✅ Changed from 1 to 2 for better visibility
    marginBottom: 8,
  },
  disabledInput: {
    opacity: 0.6,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  divider: {
    height: 1,
    marginVertical: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 32,
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.6, // ✅ Reduced opacity when disabled
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default EditProfileScreen;