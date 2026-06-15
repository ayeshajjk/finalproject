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
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { classifyMaize } from '../services/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================================
// 🌽 PARSE BACKEND PREDICTION INTO VARIETY + GRADE
// ============================================================
// Backend returns labels like: "Hybrid_local_white_damaged", "Agalwoi_white_good", "Popcorn_impure"
// We split off the last segment as grade and format the rest as the variety name.

const KNOWN_GRADES = ['good', 'damaged', 'impure'];

const parsePrediction = (rawPrediction) => {
  if (!rawPrediction || typeof rawPrediction !== 'string') {
    return { variety: 'Unknown', grade: 'Unknown' };
  }

  const lower = rawPrediction.toLowerCase();
  let grade = 'Unknown';
  let variety = rawPrediction;

  for (const g of KNOWN_GRADES) {
    if (lower.endsWith(`_${g}`)) {
      grade = g.charAt(0).toUpperCase() + g.slice(1); // "Damaged"
      variety = rawPrediction.slice(0, -(g.length + 1)); // remove "_damaged"
      break;
    }
  }

  // Clean up underscores → spaces, capitalize each word
  variety = variety
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  if (!variety) variety = 'Unknown';

  return { variety, grade };
};

const ScanScreen = ({ navigation }) => {
  const { user, refreshProfile } = useAuth();

  const [permission, requestPermission] = useCameraPermissions();

  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef(null);

  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [currentImage, setCurrentImage] = useState(null);
  const [classification, setClassification] = useState('');
  const [grade, setGrade] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [allPredictions, setAllPredictions] = useState(null);
  const [recentScans, setRecentScans] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (user && !loading) {
        loadRecentScans();
      }
    }, [user, loading])
  );

  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    if (Platform.OS === 'web') {
      setHasCameraPermission(true);
      return;
    }

    try {
      if (!permission) {
        const result = await requestPermission();
        setHasCameraPermission(result.granted);
      } else {
        setHasCameraPermission(permission.granted);
        if (!permission.granted) {
          const result = await requestPermission();
          setHasCameraPermission(result.granted);
        }
      }

      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('Media permission:', mediaPermission.status);

      try {
        const notifPerm = await Notifications.getPermissionsAsync();
        if (notifPerm.status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch (notifError) {
        console.log('Notification permission error (non-critical):', notifError);
      }
    } catch (error) {
      console.error('Permission error:', error);
      setHasCameraPermission(false);
    }
  };

  if (hasCameraPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color="#9CA3AF" />
        <Text style={styles.permissionText}>No access to camera</Text>
        <Text style={styles.permissionSubtext}>
          Please grant camera permission in settings to use the scanner.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermissions}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={handlePickImage}
        >
          <Feather name="image" size={20} color="#18392B" />
          <Text style={styles.galleryButtonText}>Choose from Gallery</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const loadRecentScans = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) {
        console.error('Error loading scans:', error.message);
        return;
      }
      if (data) {
        setRecentScans(data);
      }
    } catch (error) {
      console.error('Load error:', error.message);
    }
  };

  const loadNotificationPrefs = async () => {
    if (!user) return null;
    try {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('scan_completion, push_notifications, sound_enabled, vibration_enabled')
        .eq('user_id', user.id)
        .maybeSingle();
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
      if (!prefs || !prefs.push_notifications || !prefs.scan_completion) return;
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
      Alert.alert('Camera Not Available', 'Please use gallery instead.');
      return;
    }
    if (hasCameraPermission !== true) {
      Alert.alert('Permission Required', 'Camera permission is required.');
      return;
    }
    if (!cameraReady || !cameraRef.current) {
      Alert.alert('Camera Not Ready', 'Please wait for camera to initialize...');
      return;
    }
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: true,
        base64: true,
      });
      processImage(photo.uri, photo.base64);
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Could not take picture: ' + error.message);
    }
  };

  const handlePickImage = async () => {
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permission.status !== 'granted') {
          Alert.alert('Permission Required', 'Please grant photo library access');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        processImage(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (error) {
      console.error('Picker error:', error);
      Alert.alert('Error', 'Could not open gallery: ' + error.message);
    }
  };

  // ============================================================
  // ✅ FIXED: Maps backend response fields correctly
  // ============================================================
  const processImage = async (imageUri, base64Data) => {
    setLoading(true);
    setCurrentImage(imageUri);
    try {
      let finalBase64 = base64Data;

      // Fallback: If Base64 somehow wasn't passed, try reading it manually
      if (!finalBase64) {
        if (Platform.OS === 'web') {
          throw new Error('Could not extract image data. Please try again.');
        } else {
          finalBase64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }
      }

      // STRIP THE PREFIX: Web sometimes leaves "data:image/jpeg;base64," at the start
      const cleanBase64 = finalBase64.replace(/^data:image\/\w+;base64,/, '');

      if (!cleanBase64 || cleanBase64.length < 100) {
        throw new Error('Image data is empty or too small.');
      }

      console.log(`🧠 Sending ${cleanBase64.length} chars of base64 to backend...`);

      // ✅ Call backend AI using BASE64 directly
      const apiResult = await classifyMaize(null, cleanBase64);
      console.log('✅ Backend result:', apiResult);

      // ============================================================
      // ✅ FIXED FIELD MAPPING
      // Backend returns: { success, prediction, confidence, all_probabilities }
      // prediction = "Hybrid_local_white_damaged" (variety + grade combined)
      // ============================================================

      if (!apiResult.success) {
        throw new Error(apiResult.error || 'Backend returned unsuccessful response');
      }

      const rawPrediction = apiResult.prediction || '';
      const confidenceResult =
        apiResult.confidence !== undefined ? Math.round(apiResult.confidence) : 0;

      // ✅ Parse "Hybrid_local_white_damaged" → variety + grade
      const { variety: classificationResult, grade: gradeResult } =
        parsePrediction(rawPrediction);

      console.log('📋 Parsed → Variety:', classificationResult, '| Grade:', gradeResult, '| Confidence:', confidenceResult);

      if (!classificationResult || classificationResult === 'Unknown') {
        throw new Error(
          `Backend returned unrecognized prediction: "${rawPrediction}"`
        );
      }

      // ✅ Map all_probabilities → all_predictions for display
      // Group by variety and also keep raw probabilities
      const rawProbabilities = apiResult.all_probabilities || {};
      const allPreds = {};
      Object.entries(rawProbabilities).forEach(([label, prob]) => {
        const { variety } = parsePrediction(label);
        // Sum probabilities for the same variety across grades
        if (allPreds[variety]) {
          allPreds[variety] += prob;
        } else {
          allPreds[variety] = prob;
        }
      });

      // Upload to Supabase for history display (non-blocking, graceful failure)
      let publicUrl = null;
      try {
        const arrayBuffer = decode(cleanBase64);
        const fileName = `scan_${Date.now()}.jpg`;
        const filePath = `${user.id}/${fileName}`;

        console.log(`⬆️ Uploading ${arrayBuffer.byteLength} bytes to Supabase...`);
        const { error: uploadError } = await supabase.storage
          .from('scan-images')
          .upload(filePath, arrayBuffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.warn('⚠️ Supabase upload failed (non-critical):', uploadError.message);
        } else {
          const {
            data: { publicUrl: url },
          } = supabase.storage.from('scan-images').getPublicUrl(filePath);
          publicUrl = url;
          console.log('✅ Uploaded to Supabase:', publicUrl);
        }
      } catch (uploadErr) {
        console.warn('⚠️ Supabase upload error (non-critical):', uploadErr.message);
      }

      // Save to Database
      const imageUrlForDb = publicUrl || '';
      const { error: scanError } = await supabase
        .from('scan_history')
        .insert([
          {
            user_id: user.id,
            image_url: imageUrlForDb,
            classification: classificationResult,
            grade: gradeResult.toLowerCase(),
            confidence: confidenceResult,
          },
        ])
        .select();

      if (scanError) throw new Error(`Database error: ${scanError.message}`);

      setClassification(classificationResult);
      setGrade(gradeResult);
      setConfidence(confidenceResult);
      setAllPredictions(
        Object.keys(allPreds).length > 0 ? allPreds : null
      );
      setLoading(false);
      setShowPreview(true);

      await loadRecentScans();
      try {
        await refreshProfile();
      } catch (e) {
        console.warn('Profile refresh failed:', e.message);
      }

      await sendScanCompleteNotification({
        classificationResult,
        gradeResult,
        confidenceResult,
      });
    } catch (error) {
      console.error('Processing failed:', error);
      setLoading(false);
      let errorMessage = 'Could not analyze the image. ';
      if (error.message?.includes('Network request failed')) {
        errorMessage += 'Make sure the backend server is running.';
      } else if (error.message?.includes('Database')) {
        errorMessage += 'Database save failed. Check Supabase connection.';
      } else if (error.message?.includes('upload')) {
        errorMessage += 'Image upload failed. Check Supabase storage.';
      } else {
        errorMessage += error.message || 'Unknown error occurred.';
      }
      Alert.alert('Analysis Failed', errorMessage, [{ text: 'OK' }]);
    }
  };

  const handleScanAnother = () => {
    setShowPreview(false);
    setCurrentImage(null);
    setClassification('');
    setGrade('');
    setConfidence(0);
    setAllPredictions(null);
  };

  const getGradeColor = (gradeVal) => {
    const gradeColors = {
      good: ['#10B981', '#059669'],
      Good: ['#10B981', '#059669'],
      damaged: ['#F59E0B', '#D97706'],
      Damaged: ['#F59E0B', '#D97706'],
      impure: ['#EF4444', '#DC2626'],
      Impure: ['#EF4444', '#DC2626'],
    };
    return gradeColors[gradeVal] || ['#6B7280', '#4B5563'];
  };

  const getGradeIcon = (gradeVal) => {
    const gradeLower = gradeVal?.toLowerCase();
    if (gradeLower === 'good') return 'checkmark-circle';
    if (gradeLower === 'damaged') return 'alert-circle';
    if (gradeLower === 'impure') return 'close-circle';
    return 'help-circle';
  };

  const handleCameraReady = () => {
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

  if (loading) {
    return (
      <LinearGradient colors={['#18392B', '#14452F']} style={styles.container}>
        <StatusBar backgroundColor="#18392B" barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingImageWrapper}>
            {currentImage && (
              <Image source={{ uri: currentImage }} style={styles.loadingImage} />
            )}
            <LinearGradient
              colors={['transparent', 'rgba(24, 57, 43, 0.9)']}
              style={styles.imageOverlay}
            />
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
                <Text style={[styles.stepText, { color: '#9CA3AF' }]}>
                  Evaluating quality
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    );
  }

  if (showPreview && currentImage && classification && grade) {
    return (
      <View style={styles.container}>
        <StatusBar backgroundColor="#18392B" barStyle="light-content" />
        <LinearGradient
          colors={['#18392B', '#14452F']}
          style={styles.previewHeader}
        >
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
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.3)']}
              style={styles.previewImageOverlay}
            />
            <View style={styles.confidenceBadge}>
              <Ionicons
                name="analytics"
                size={16}
                color="#FFFFFF"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.confidenceText}>{confidence}% Confident</Text>
            </View>
          </View>
          <View style={styles.resultsContainer}>
            <View style={styles.resultsCard}>
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
              <View style={styles.resultItem}>
                <View style={styles.resultIconContainer}>
                  <Ionicons
                    name={getGradeIcon(grade)}
                    size={24}
                    color="#18392B"
                  />
                </View>
                <View style={styles.resultTextContainer}>
                  <Text style={styles.resultLabel}>Quality Grade</Text>
                  <LinearGradient
                    colors={getGradeColor(grade)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.gradeBadgeLarge}
                  >
                    <Ionicons
                      name={getGradeIcon(grade)}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.gradeBadgeText}>
                      {grade.charAt(0).toUpperCase() + grade.slice(1)}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
              <View style={styles.resultDivider} />
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
                        style={[
                          styles.confidenceFill,
                          { width: `${confidence}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.confidencePercentage}>
                      {confidence}%
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            {allPredictions && Object.keys(allPredictions).length > 1 && (
              <View style={styles.allPredictionsCard}>
                <Text style={styles.allPredictionsTitle}>
                  <Ionicons name="list" size={18} color="#18392B" /> All
                  Predictions
                </Text>
                {Object.entries(allPredictions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([variety, conf], index) => (
                    <View key={variety} style={styles.predictionRow}>
                      <View style={styles.predictionRank}>
                        <Text style={styles.predictionRankText}>
                          {index + 1}
                        </Text>
                      </View>
                      <Text style={styles.predictionVariety}>{variety}</Text>
                      <View style={styles.predictionConfBar}>
                        <View
                          style={[
                            styles.predictionConfFill,
                            { width: `${Math.min(conf, 100)}%` },
                          ]}
                        />
                      </View>
                      <Text style={styles.predictionConfText}>
                        {conf.toFixed(1)}%
                      </Text>
                    </View>
                  ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleScanAnother}
            >
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
                        <Image
                          source={{ uri: scan.image_url }}
                          style={styles.recentImageHorizontal}
                        />
                        <View style={styles.recentOverlay}>
                          <Text
                            style={styles.recentClassSmall}
                            numberOfLines={1}
                          >
                            {scan.classification}
                          </Text>
                          <LinearGradient
                            colors={getGradeColor(scan.grade)}
                            style={styles.recentGradeBadgeSmall}
                          >
                            <Text style={styles.recentGradeSmall}>
                              {scan.grade}
                            </Text>
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

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#18392B" barStyle="light-content" />
      <LinearGradient
        colors={['#18392B', '#14452F']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>Maize Classifier</Text>
            <Text style={styles.headerSubtitle}>
              AI-Powered Quality Analysis
            </Text>
          </View>
          <View style={styles.headerIconContainer}>
            <Ionicons name="scan" size={28} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>
      <ScrollView style={styles.mainScroll}>
        {Platform.OS !== 'web' && hasCameraPermission === true ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing={CameraType.back}
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
                  <Ionicons
                    name="information-circle"
                    size={16}
                    color="#FFFFFF"
                  />{' '}
                  Position maize kernels in frame
                </Text>
              </View>
            </CameraView>
          </View>
        ) : (
          <View style={styles.webPlaceholder}>
            <LinearGradient
              colors={['#E8F5E9', '#C8E6C9']}
              style={styles.webPlaceholderGradient}
            >
              <Ionicons name="image-outline" size={80} color="#18392B" />
              <Text style={styles.webPlaceholderText}>
                Select maize image to analyze
              </Text>
              <Text style={styles.webPlaceholderSubtext}>
                Upload from your gallery
              </Text>
            </LinearGradient>
          </View>
        )}
        <View style={styles.actionButtonsContainer}>
          <TouchableOpacity
            style={styles.actionButtonPrimary}
            onPress={handlePickImage}
          >
            <LinearGradient
              colors={['#18392B', '#14452F']}
              style={styles.actionButtonGradient}
            >
              <Feather name="image" size={24} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Choose from Gallery</Text>
            </LinearGradient>
          </TouchableOpacity>
          {Platform.OS !== 'web' && hasCameraPermission === true && (
            <TouchableOpacity
              style={styles.actionButtonSecondary}
              onPress={handleTakePicture}
            >
              <Feather name="camera" size={24} color="#18392B" />
              <Text style={styles.actionButtonTextSecondary}>
                {cameraReady ? 'Take Photo' : 'Camera Loading...'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Quality Grades</Text>
          <View style={styles.gradesInfo}>
            <View style={styles.gradeInfoItem}>
              <LinearGradient
                colors={['#10B981', '#059669']}
                style={styles.gradeInfoBadge}
              >
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Good</Text>
                <Text style={styles.gradeInfoDesc}>
                  High quality, no defects
                </Text>
              </View>
            </View>
            <View style={styles.gradeInfoItem}>
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                style={styles.gradeInfoBadge}
              >
                <Ionicons name="alert-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Damaged</Text>
                <Text style={styles.gradeInfoDesc}>
                  Physical damage present
                </Text>
              </View>
            </View>
            <View style={styles.gradeInfoItem}>
              <LinearGradient
                colors={['#EF4444', '#DC2626']}
                style={styles.gradeInfoBadge}
              >
                <Ionicons name="close-circle" size={20} color="#FFFFFF" />
              </LinearGradient>
              <View style={styles.gradeInfoText}>
                <Text style={styles.gradeInfoTitle}>Impure</Text>
                <Text style={styles.gradeInfoDesc}>
                  Contains foreign matter
                </Text>
              </View>
            </View>
          </View>
        </View>
        {recentScans.length > 0 ? (
          <View style={styles.recentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Scans</Text>
              <Text style={styles.sectionCount}>{recentScans.length}</Text>
            </View>
            <View style={styles.recentGrid}>
              {recentScans.map((scan) => (
                <View key={scan.id} style={styles.recentCard}>
                  <Image
                    source={{ uri: scan.image_url }}
                    style={styles.recentImage}
                  />
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.recentCardOverlay}
                  >
                    <Text style={styles.recentClass} numberOfLines={1}>
                      {scan.classification}
                    </Text>
                    <LinearGradient
                      colors={getGradeColor(scan.grade)}
                      style={styles.recentGradeBadge}
                    >
                      <Ionicons
                        name={getGradeIcon(scan.grade)}
                        size={12}
                        color="#FFFFFF"
                      />
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
              Start by uploading or capturing an image of maize kernels to get
              instant variety classification and quality analysis
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB', padding: 30 },
  permissionText: { marginTop: 16, fontSize: 20, color: '#1F2937', fontWeight: '700' },
  permissionSubtext: { marginTop: 8, fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  permissionButton: { marginTop: 24, backgroundColor: '#18392B', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  permissionButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  galleryButton: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: '#18392B' },
  galleryButtonText: { color: '#18392B', fontSize: 15, fontWeight: '700' },
  header: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', marginTop: 4 },
  headerIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.3)' },
  mainScroll: { flex: 1 },
  cameraContainer: { height: 450, backgroundColor: '#000', margin: 20, borderRadius: 20, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  scanFrame: { width: 280, height: 280, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: '#FFFFFF', borderWidth: 4 },
  cornerTL: { top: 0, left: 0, borderBottomWidth: 0, borderRightWidth: 0 },
  cornerTR: { top: 0, right: 0, borderBottomWidth: 0, borderLeftWidth: 0 },
  cornerBL: { bottom: 0, left: 0, borderTopWidth: 0, borderRightWidth: 0 },
  cornerBR: { bottom: 0, right: 0, borderTopWidth: 0, borderLeftWidth: 0 },
  cameraHint: { color: '#FFFFFF', fontSize: 15, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25, marginTop: 30, fontWeight: '600' },
  webPlaceholder: { height: 400, margin: 20, borderRadius: 20, overflow: 'hidden' },
  webPlaceholderGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#18392B', borderStyle: 'dashed', borderRadius: 20 },
  webPlaceholderText: { fontSize: 20, fontWeight: '700', color: '#18392B', marginTop: 20 },
  webPlaceholderSubtext: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  actionButtonsContainer: { paddingHorizontal: 20, marginBottom: 20, gap: 12 },
  actionButtonPrimary: { borderRadius: 16, overflow: 'hidden', shadowColor: '#18392B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  actionButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  actionButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  actionButtonSecondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', paddingVertical: 18, borderRadius: 16, gap: 12, borderWidth: 2, borderColor: '#18392B' },
  actionButtonTextSecondary: { color: '#18392B', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  infoSection: { paddingHorizontal: 20, marginBottom: 30 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#18392B', marginBottom: 16 },
  varietyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  varietyCard: { width: '48%', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  varietyIconContainer: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  varietyName: { fontSize: 13, fontWeight: '700', color: '#18392B', textAlign: 'center' },
  gradesInfo: { gap: 12 },
  gradeInfoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  gradeInfoBadge: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  gradeInfoText: { flex: 1 },
  gradeInfoTitle: { fontSize: 16, fontWeight: '700', color: '#18392B', marginBottom: 4 },
  gradeInfoDesc: { fontSize: 13, color: '#6B7280' },
  recentSection: { paddingHorizontal: 20, marginBottom: 30 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionCount: { fontSize: 16, fontWeight: '700', color: '#18392B', backgroundColor: '#E8F5E9', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  recentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  recentCard: { width: '48%', height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 },
  recentImage: { width: '100%', height: '100%' },
  recentCardOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 12 },
  recentClass: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  recentGradeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-start' },
  recentGrade: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', padding: 40, marginHorizontal: 20, marginBottom: 30, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 2, borderColor: '#E8F5E9', borderStyle: 'dashed' },
  emptyIconContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#18392B', marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20 },
  loadingContainer: { flex: 1, justifyContent: 'center' },
  loadingImageWrapper: { flex: 1, position: 'relative' },
  loadingImage: { width: '100%', height: '100%' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '50%' },
  loadingContent: { position: 'absolute', bottom: 60, left: 20, right: 20, alignItems: 'center' },
  scanningIndicator: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 3, borderColor: 'rgba(255, 255, 255, 0.4)' },
  scanLine: { position: 'absolute', width: 60, height: 3, backgroundColor: '#10B981', borderRadius: 2 },
  loadingTitle: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', marginBottom: 8, textAlign: 'center' },
  loadingSubtext: { fontSize: 15, color: 'rgba(255, 255, 255, 0.8)', textAlign: 'center', marginBottom: 32 },
  processingSteps: { width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 16, padding: 20, gap: 16 },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600' },
  previewHeader: { paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
  headerRight: { width: 44, height: 44 },
  previewScroll: { flex: 1 },
  previewImageContainer: { height: 400, backgroundColor: '#000', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  previewImageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  confidenceBadge: { position: 'absolute', top: 20, right: 20, backgroundColor: 'rgba(16, 185, 129, 0.95)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  confidenceText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  resultsContainer: { padding: 20 },
  resultsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  resultItem: { flexDirection: 'row', alignItems: 'flex-start' },
  resultIconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  resultTextContainer: { flex: 1 },
  resultLabel: { fontSize: 13, color: '#6B7280', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  resultValue: { fontSize: 20, fontWeight: '700', color: '#18392B' },
  resultDivider: { height: 1, backgroundColor: '#E8F5E9', marginVertical: 20 },
  gradeBadgeLarge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, alignSelf: 'flex-start', gap: 6 },
  gradeBadgeText: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  confidenceBarContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  confidenceBar: { flex: 1, height: 12, backgroundColor: '#E8F5E9', borderRadius: 6, overflow: 'hidden' },
  confidenceFill: { height: '100%', borderRadius: 6 },
  confidencePercentage: { fontSize: 16, fontWeight: '700', color: '#18392B', minWidth: 45 },
  allPredictionsCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  allPredictionsTitle: { fontSize: 16, fontWeight: '700', color: '#18392B', marginBottom: 16 },
  predictionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  predictionRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E8F5E9', justifyContent: 'center', alignItems: 'center' },
  predictionRankText: { fontSize: 13, fontWeight: '700', color: '#18392B' },
  predictionVariety: { flex: 1, fontSize: 14, fontWeight: '600', color: '#18392B' },
  predictionConfBar: { width: 60, height: 6, backgroundColor: '#E8F5E9', borderRadius: 3, overflow: 'hidden' },
  predictionConfFill: { height: '100%', backgroundColor: '#10B981', borderRadius: 3 },
  predictionConfText: { fontSize: 13, fontWeight: '700', color: '#6B7280', width: 50, textAlign: 'right' },
  primaryButton: { borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#18392B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  primaryButtonGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, gap: 12 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.5 },
  recentHorizontalList: { flexDirection: 'row', gap: 12, paddingRight: 20 },
  recentCardHorizontal: { width: 140, height: 140, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000' },
  recentImageHorizontal: { width: '100%', height: '100%' },
  recentOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10 },
  recentClassSmall: { fontSize: 11, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  recentGradeBadgeSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  recentGradeSmall: { fontSize: 10, fontWeight: '700', color: '#FFFFFF' },
});

export default ScanScreen;