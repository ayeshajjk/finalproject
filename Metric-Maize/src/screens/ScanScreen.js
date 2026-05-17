import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { classifyMaize } from '../services/api'; // ✅ Import API service

// Show notifications even when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const ScanScreen = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();

  // States
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Scan data
  const [currentImage, setCurrentImage] = useState(null);
  const [classification, setClassification] = useState('');
  const [grade, setGrade] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [allPredictions, setAllPredictions] = useState(null); // ✅ Store all predictions
  const [recentScans, setRecentScans] = useState([]);

  // ✅ Use useFocusEffect to reload scans when screen is focused
  useFocusEffect(
    useCallback(() => {
      console.log('📱 ScanScreen focused - reloading scans');
      loadRecentScans();
    }, [user])
  );

  useEffect(() => {
    console.log('ScanScreen mounted');
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      console.log('🌐 Running on web - skipping native permissions');
      setHasCameraPermission(true);
      return;
    }

    try {
      const cameraPermission = await Camera.requestCameraPermissionsAsync();
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      console.log('Camera permission:', cameraPermission.status);
      console.log('Media permission:', mediaPermission.status);

      setHasCameraPermission(cameraPermission.status === 'granted');

      try {
        const notifPerm = await Notifications.getPermissionsAsync();
        if (notifPerm.status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          console.log('Notification permission:', req.status);
        } else {
          console.log('Notification permission: granted');
        }
      } catch (notifError) {
        console.log('Notification permission error (non-critical):', notifError);
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasCameraPermission(false);
      Alert.alert('Permission Error', 'Could not request permissions. Some features may not work.');
    }
  };

  const loadRecentScans = async () => {
    if (!user) {
      console.log('No user, skipping load');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);

      if (error) {
        console.error('Error loading scans:', error);
        return;
      }

      if (data) {
        console.log('✅ Loaded', data.length, 'scans');
        setRecentScans(data);
      }
    } catch (error) {
      console.error('Load error:', error);
    }
  };

  const loadNotificationPrefs = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('scan_completion, push_notifications, sound_enabled, vibration_enabled')
        .eq('user_id', user.id)
        .single();

      if (error || !data) {
        return {
          scan_completion: true,
          push_notifications: true,
          sound_enabled: true,
          vibration_enabled: true,
        };
      }

      return {
        scan_completion: data.scan_completion ?? true,
        push_notifications: data.push_notifications ?? true,
        sound_enabled: data.sound_enabled ?? true,
        vibration_enabled: data.vibration_enabled ?? true,
      };
    } catch (e) {
      console.error('Error loading notification prefs:', e);
      return {
        scan_completion: true,
        push_notifications: true,
        sound_enabled: true,
        vibration_enabled: true,
      };
    }
  };

  const sendScanCompleteNotification = async ({
    classificationResult,
    gradeResult,
    confidenceResult,
  }) => {
    if (Platform.OS === 'web') return;

    try {
      const prefs = await loadNotificationPrefs();
      if (!prefs) return;

      if (!prefs.push_notifications) return;
      if (!prefs.scan_completion) return;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🌽 Scan Complete',
          body: `${classificationResult} • ${gradeResult} • ${confidenceResult}% confidence`,
          data: { type: 'scan_completion' },
          sound: prefs.sound_enabled ? 'default' : null,
          vibrate: prefs.vibration_enabled ? [0, 250, 250, 250] : undefined,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (e) {
      console.log('Notification error (non-critical):', e);
    }
  };

  const handleTakePicture = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera Not Available', 'Camera is not available on web. Please use gallery instead.');
      return;
    }

    if (hasCameraPermission !== true) {
      Alert.alert('Permission Required', 'Camera permission is required to take photos.');
      return;
    }

    if (!cameraReady || !cameraRef.current) {
      Alert.alert('Camera Not Ready', 'Please wait for camera to initialize...');
      return;
    }

    try {
      console.log('📸 Taking picture...');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
      });
      console.log('✅ Photo taken:', photo.uri);
      processImage(photo.uri);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Could not take picture: ' + error.message);
    }
  };

  const handlePickImage = async () => {
    try {
      console.log('🖼️ Opening gallery...');

      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant photo library access');
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      console.log('📷 Picker result:', result);

      if (!result.canceled && result.assets?.[0]?.uri) {
        console.log('✅ Image selected:', result.assets[0].uri);
        processImage(result.assets[0].uri);
      } else {
        console.log('❌ Selection cancelled');
      }
    } catch (error) {
      console.error('❌ Picker error:', error);
      Alert.alert('Error', 'Could not open gallery: ' + error.message);
    }
  };

  // ✅ Updated processImage to call backend API
  const processImage = async (imageUri) => {
    console.log('⚙️ Processing image:', imageUri);

    setLoading(true);
    setCurrentImage(imageUri);

    try {
      console.log('🔄 Sending to AI model...');
      
      // ✅ Call backend API
      const result = await classifyMaize(imageUri);
      
      console.log('✅ API Response:', result);

      if (!result.success) {
        throw new Error(result.error || 'Prediction failed');
      }

      const classificationResult = result.predicted_class || result.predicted_disease;
      const gradeResult = result.grade || 'Unknown';
      const confidenceResult = Math.round(result.confidence);

      console.log('✅ Classification:', classificationResult);
      console.log('✅ Grade:', gradeResult);
      console.log('✅ Confidence:', confidenceResult + '%');

      // ✅ Save to database
      console.log('💾 Saving to database...');
      const { data, error } = await supabase
        .from('scan_history')
        .insert([
          {
            user_id: user.id,
            image_url: imageUri,
            classification: classificationResult,
            grade: gradeResult,
            confidence: confidenceResult,
          },
        ])
        .select();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Saved successfully');

      setClassification(classificationResult);
      setGrade(gradeResult);
      setConfidence(confidenceResult);
      setAllPredictions(result.all_predictions || null); // ✅ Store all predictions
      setLoading(false);
      setShowPreview(true);

      // ✅ Reload recent scans
      await loadRecentScans();

      // ✅ Refresh profile to update total scans count
      await refreshProfile();

      // Send notification
      await sendScanCompleteNotification({
        classificationResult,
        gradeResult,
        confidenceResult,
      });

      if (navigation) {
        console.log('✅ Navigation ready for screen updates');
      }
    } catch (error) {
      console.error('❌ Processing failed:', error);
      setLoading(false);
      Alert.alert(
        'Analysis Failed',
        error.message || 'Could not analyze the image. Please make sure the backend server is running and try again.',
        [
          { text: 'OK' },
          {
            text: 'Retry',
            onPress: () => processImage(imageUri),
          },
        ]
      );
    }
  };

  const handleScanAnother = () => {
    console.log('🔄 Resetting for new scan');
    setShowPreview(false);
    setCurrentImage(null);
    setClassification('');
    setGrade('');
    setConfidence(0);
    setAllPredictions(null);
  };

  // ✅ Updated grade colors for your specific grades
  const getGradeColor = (grade) => {
    const gradeColors = {
      'good': ['#10B981', '#059669'],       // Green for good
      'Good': ['#10B981', '#059669'],
      'damaged': ['#F59E0B', '#D97706'],    // Orange for damaged
      'Damaged': ['#F59E0B', '#D97706'],
      'impure': ['#EF4444', '#DC2626'],     // Red for impure
      'Impure': ['#EF4444', '#DC2626'],
    };
    return gradeColors[grade] || ['#6B7280', '#4B5563'];
  };

  // ✅ Get icon for grade
  const getGradeIcon = (grade) => {
    const gradeLower = grade?.toLowerCase();
    if (gradeLower === 'good') return 'checkmark-circle';
    if (gradeLower === 'damaged') return 'alert-circle';
    if (gradeLower === 'impure') return 'close-circle';
    return 'help-circle';
  };

  const handleCameraReady = () => {
    console.log('📷 Camera is ready');
    setCameraReady(true);
  };

  if (hasCameraPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#18392B" />
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  // LOADING SCREEN
  if (loading) {
    return (
      <LinearGradient colors={['#18392B', '#14452F']} style={styles.container}>
        <StatusBar backgroundColor="#18392B" barStyle="light-content" />

        <View style={styles.loadingContainer}>
          <View style={styles.loadingImageWrapper}>
            {currentImage && <Image source={{ uri: currentImage }} style={styles.loadingImage} />}
            <LinearGradient colors={['transparent', 'rgba(24, 57, 43, 0.9)']} style={styles.imageOverlay} />
          </View>

          <View style={styles.loadingContent}>
            <View style={styles.scanningIndicator}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <View style={styles.scanLine} />
            </View>

            <Text style={styles.loadingTitle}>Analyzing Maize</Text>
            <Text style={styles.loadingSubtext}>AI is examining your sample...</Text>

            <View style={styles.processingSteps}>
              <View style={styles.stepItem}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <Text style={styles.stepText}>Image uploaded</Text>
              </View>
              <View style={styles.stepItem}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.stepText}>Identifying variety</Text>
              </View>
              <View style={styles.stepItem}>
                <Feather name="clock" size={18} color="#9CA3AF" />
                <Text style={[styles.stepText, { color: '#9CA3AF' }]}>Evaluating quality</Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  // PREVIEW SCREEN
  if (showPreview && currentImage && classification && grade) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#18392B" barStyle="light-content" />

        <LinearGradient colors={['#18392B', '#14452F']} style={styles.previewHeader}>
          <TouchableOpacity onPress={handleScanAnother} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Scan Results</Text>
            <Text style={styles.headerSubtitle}>Analysis Complete</Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons name="checkmark-circle" size={28} color="#10B981" />
          </View>
        </LinearGradient>

        <ScrollView style={styles.previewScroll}>
          <View style={styles.previewImageContainer}>
            <Image source={{ uri: currentImage }} style={styles.previewImage} />
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.3)']} style={styles.previewImageOverlay} />
            <View style={styles.confidenceBadge}>
              <Ionicons name="analytics" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.confidenceText}>{confidence}% Confident</Text>
            </View>
          </View>

          <View style={styles.resultsContainer}>
            <View style={styles.resultsCard}>
              {/* Maize Variety */}
              <View style={styles.resultItem}>
                <View style={styles.resultIconContainer}>
                  <MaterialIcons name="grass" size={24} color="#18392B" />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultLabel}>Maize Variety</Text>
                  <Text style={styles.resultValue}>{classification}</Text>
                </View>
              </View>

              <View style={styles.resultDivider} />

              {/* Quality Grade */}
              <View style={styles.resultItem}>
                <View style={styles.resultIconContainer}>
                  <Ionicons name={getGradeIcon(grade)} size={24} color="#18392B" />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultLabel}>Quality Grade</Text>
                  <LinearGradient
                    colors={getGradeColor(grade)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradeBadgeLarge}
                  >
                    <Ionicons name={getGradeIcon(grade)} size={16} color="#FFFFFF" />
                    <Text style={styles.gradeBadgeText}>{grade.charAt(0).toUpperCase() + grade.slice(1)}</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.resultDivider} />

              {/* Confidence Score */}
              <View style={styles.resultItem}>
                <View style={styles.resultIconContainer}>
                  <Feather name="activity" size={24} color="#18392B" />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultLabel}>Confidence Score</Text>
                  <View style={styles.confidenceBarContainer}>
                    <View style={styles.confidenceBar}>
                      <LinearGradient
                        colors={['#10B981', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.confidenceFill, { width: `${confidence}%` }]}
                      />
                    </View>
                    <Text style={styles.confidencePercentage}>{confidence}%</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ✅ Show all predictions if available */}
            {allPredictions && Object.keys(allPredictions).length > 1 && (
              <View style={styles.allPredictionsCard}>
                <Text style={styles.allPredictionsTitle}>
                  <Ionicons name="list" size={18} color="#18392B" /> All Predictions
                </Text>
                {Object.entries(allPredictions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([variety, conf], index) => (
                    <View key={variety} style={styles.predictionRow}>
                      <View style={styles.predictionRank}>
                        <Text style={styles.predictionRankText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.predictionVariety}>{variety}</Text>
                      <View style={styles.predictionConfBar}>
                        <View style={[styles.predictionConfFill, { width: `${conf * 100}%` }]} />
                      </View>
                      <Text style={styles.predictionConfText}>{(conf * 100).toFixed(1)}%</Text>
                    </View>
                  ))}
              </View>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={handleScanAnother}>
              <LinearGradient
                colors={['#18392B', '#14452F']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Feather name="camera" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Scan Another</Text>
              </LinearGradient>
            </TouchableOpacity>

            {recentScans.length > 1 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionTitle}>Recent Scans</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.recentHorizontalList}>
                    {recentScans.slice(1).map((scan) => (
                      <View key={scan.id} style={styles.recentCardHorizontal}>
                        <Image source={{ uri: scan.image_url }} style={styles.recentImageHorizontal} />
                        <View style={styles.recentOverlay}>
                          <Text style={styles.recentClassSmall} numberOfLines={1}>
                            {scan.classification}
                          </Text>
                          <LinearGradient
                            colors={getGradeColor(scan.grade)}
                            style={styles.recentGradeBadgeSmall}
                          >
                            <Text style={styles.recentGradeSmall}>{scan.grade}</Text>
                          </LinearGradient>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // MAIN SCAN SCREEN
  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#18392B" barStyle="light-content" />

      <LinearGradient colors={['#18392B', '#14452F']} style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Maize Classifier</Text>
            <Text style={styles.headerSubtitle}>AI-Powered Quality Analysis</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <Ionicons name="scan" size={28} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.mainScroll}>
        {/* Camera Preview or Placeholder */}
        {Platform.OS !== 'web' && hasCameraPermission === true ? (
          <View style={styles.cameraContainer}>
            <Camera
              style={styles.camera}
              type={Camera.Constants?.Type?.back || 0}
              ref={cameraRef}
              onCameraReady={handleCameraReady}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <Text style={styles.cameraHint}>
                  <Ionicons name="information-circle" size={16} color="#FFFFFF" /> Position maize kernels in frame
                </Text>
              </View>
            </Camera>
          </View>
        ) : (
          <View style={styles.webPlaceholder}>
            <LinearGradient colors={['#E8F5E9', '#C8E6C9']} style={styles.webPlaceholderGradient}>
              <Ionicons name="image-outline" size={80} color="#18392B" />
              <Text style={styles.webPlaceholderText}>Select maize image to analyze</Text>
              <Text style={styles.webPlaceholderSubtext}>Upload from your gallery</Text>
            </LinearGradient>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity style={styles.actionButtonPrimary} onPress={handlePickImage}>
            <LinearGradient colors={['#18392B', '#14452F']} style={styles.actionButtonGradient}>
              <Feather name="image" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Choose from Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>

          {Platform.OS !== 'web' && hasCameraPermission === true && (
            <TouchableOpacity style={styles.actionButtonSecondary} onPress={handleTakePicture}>
              <Feather name="camera" size={24} color="#18392B" />
              <Text style={styles.actionButtonTextSecondary}>
                {cameraReady ? 'Take Photo' : 'Camera Loading...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ✅ Updated Info Section with your varieties */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Detectable Varieties</Text>
          <View style={styles.varietyGrid}>
            <View style={styles.varietyCard}>
              <View style={styles.varietyIconContainer}>
                <MaterialIcons name="grain" size={28} color="#18392B" />
              </View>
              <Text style={styles.varietyName}>Agalwoi White</Text>
            </View>
            <View style={styles.varietyCard}>
              <View style={styles.varietyIconContainer}>
                <MaterialIcons name="grain" size={28} color="#18392B" />
              </View>
              <Text style={styles.varietyName}>Hybrid Local White</Text>
            </View>
            <View style={styles.varietyCard}>
              <View style={styles.varietyIconContainer}>
                <MaterialIcons name="grain" size={28} color="#F59E0B" />
              </View>
              <Text style={styles.varietyName}>Popcorn</Text>
            </View>
            <View style={styles.varietyCard}>
              <View style={styles.varietyIconContainer}>
                <MaterialIcons name="grain" size={28} color="#DC2626" />
              </View>
              <Text style={styles.varietyName}>Redcorn</Text>
            </View>
          </View>
        </View>

        {/* ✅ Quality Grades Info */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Quality Grades</Text>
          <View style={styles.gradesInfo}>
            <View style={styles.gradeInfoItem}>
              <LinearGradient colors={['#10B981', '#059669']} style={styles.gradeInfoBadge}>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Good</Text>
                <Text style={styles.gradeInfoDesc}>High quality, no defects</Text>
              </View>
            </View>
            <View style={styles.gradeInfoItem}>
              <LinearGradient colors={['#F59E0B', '#D97706']} style={styles.gradeInfoBadge}>
                <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Damaged</Text>
                <Text style={styles.gradeInfoDesc}>Physical damage present</Text>
              </View>
            </View>
            <View style={styles.gradeInfoItem}>
              <LinearGradient colors={['#EF4444', '#DC2626']} style={styles.gradeInfoBadge}>
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Impure</Text>
                <Text style={styles.gradeInfoDesc}>Contains foreign matter</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Scans */}
        {recentScans.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Scans</Text>
              <Text style={styles.sectionCount}>{recentScans.length}</Text>
            </View>
            <View style={styles.recentGrid}>
              {recentScans.map((scan) => (
                <View key={scan.id} style={styles.recentCard}>
                  <Image source={{ uri: scan.image_url }} style={styles.recentImage} />
                  <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.recentCardOverlay}>
                    <Text style={styles.recentClass} numberOfLines={1}>
                      {scan.classification}
                    </Text>
                    <LinearGradient 
                      colors={getGradeColor(scan.grade)} 
                      style={styles.recentGradeBadge}
                    >
                      <Ionicons name={getGradeIcon(scan.grade)} size={12} color="#FFFFFF" />
                      <Text style={styles.recentGrade}>{scan.grade}</Text>
                    </LinearGradient>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MaterialIcons name="grain" size={60} color="#C8E6C9" />
            </View>
            <Text style={styles.emptyTitle}>No Scans Yet</Text>
            <Text style={styles.emptySubtext}>
              Start by uploading or capturing an image of maize kernels to get instant variety classification and quality analysis
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  permissionText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

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
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },

  mainScroll: {
    flex: 1,
  },

  cameraContainer: {
    height: 450,
    backgroundColor: '#000',
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
    borderWidth: 4,
  },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  cameraHint: {
    color: '#FFFFFF',
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 30,
    fontWeight: '600',
  },

  webPlaceholder: {
    height: 400,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  webPlaceholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#18392B',
    borderStyle: 'dashed',
    borderRadius: 20,
  },
  webPlaceholderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18392B',
    marginTop: 20,
  },
  webPlaceholderSubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },

  actionButtonsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  actionButtonPrimary: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#18392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 12,
    borderWidth: 2,
    borderColor: '#18392B',
  },
  actionButtonTextSecondary: {
    color: '#18392B',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 16,
  },

  // ✅ Variety Cards
  varietyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  varietyCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  varietyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  varietyName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18392B',
    textAlign: 'center',
  },

  // ✅ Grade Info
  gradesInfo: {
    gap: 12,
  },
  gradeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  gradeInfoBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  gradeInfoText: {
    flex: 1,
  },
  gradeInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 4,
  },
  gradeInfoDesc: {
    fontSize: 13,
    color: '#6B7280',
  },

  recentSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionCount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18392B',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recentCard: {
    width: '48%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  recentImage: {
    width: '100%',
    height: '100%',
  },
  recentCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  recentClass: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  recentGradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  recentGrade: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E8F5E9',
    borderStyle: 'dashed',
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingImageWrapper: {
    flex: 1,
    position: 'relative',
  },
  loadingImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  loadingContent: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  scanningIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  scanLine: {
    position: 'absolute',
    width: 60,
    height: 3,
    backgroundColor: '#10B981',
    borderRadius: 2,
  },
  loadingTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 32,
  },
  processingSteps: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  previewHeader: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
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
  headerRight: {
    width: 44,
    height: 44,
  },
  previewScroll: {
    flex: 1,
  },
  previewImageContainer: {
    height: 400,
    backgroundColor: '#000',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 100,
  },
  confidenceBadge: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(16, 185, 129, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  resultsContainer: {
    padding: 20,
  },
  resultsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  resultIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  resultTextContainer: {
    flex: 1,
  },
  resultLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#18392B',
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#E8F5E9',
    marginVertical: 20,
  },
  gradeBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 6,
  },
  gradeBadgeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  confidenceBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confidenceBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 6,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 6,
  },
  confidencePercentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18392B',
    minWidth: 45,
  },

  // ✅ All Predictions Card
  allPredictionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  allPredictionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 16,
  },
  predictionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  predictionRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  predictionRankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#18392B',
  },
  predictionVariety: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#18392B',
  },
  predictionConfBar: {
    width: 60,
    height: 6,
    backgroundColor: '#E8F5E9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  predictionConfFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  predictionConfText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
    width: 50,
    textAlign: 'right',
  },

  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    shadowColor: '#18392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  recentHorizontalList: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
  },
  recentCardHorizontal: {
    width: 140,
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  recentImageHorizontal: {
    width: '100%',
    height: '100%',
  },
  recentOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
  },
  recentClassSmall: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  recentGradeBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  recentGradeSmall: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default ScanScreen;