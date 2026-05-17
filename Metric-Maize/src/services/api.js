import axios from 'axios';
import { Platform } from 'react-native';

// ✅ DYNAMIC API URL BASED ON PLATFORM
const getApiUrl = () => {
  if (Platform.OS === 'web') {
    return 'http://localhost:5000';      // Web browser
  }
  if (Platform.OS === 'android') {
    // Use 10.0.2.2 for Android emulator, or LAN IP for physical device
    return 'http://192.168.1.4:5000';    // Physical Android device
    // return 'http://10.0.2.2:5000';    // Android Emulator
  }
  // iOS physical device or simulator
  return 'http://192.168.1.4:5000';
};

const API_URL = getApiUrl();

console.log(`🌐 Using API URL: ${API_URL} (Platform: ${Platform.OS})`);

/**
 * Get API information
 */
export const getApiInfo = async () => {
  try {
    const response = await axios.get(`${API_URL}/info`);
    return response.data;
  } catch (error) {
    console.error('API info failed:', error);
    throw error;
  }
};

/**
 * Classify maize image and get quality grade
 * @param {string} imageUri - Local URI of the image
 * @returns {Promise} - Classification results
 */
export const classifyMaize = async (imageUri) => {
  try {
    const formData = new FormData();

    if (Platform.OS === 'web') {
      // Web: fetch the URI as a blob and append it
      const response = await fetch(imageUri);
      const blob = await response.blob();
      formData.append('image', blob, 'maize.jpg');
    } else {
      // Native (iOS/Android): use the uri object format
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'maize.jpg',
      });
    }

    console.log('Sending image to:', `${API_URL}/classify`);

    const response = await axios.post(`${API_URL}/classify`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 30000,
    });

    console.log('Response received:', response.data);
    return response.data;

  } catch (error) {
    console.error('Classification failed:', error);

    if (error.response) {
      throw new Error(error.response.data.error || 'Classification failed');
    } else if (error.request) {
      throw new Error(`Cannot connect to server at ${API_URL}. Please ensure:\n1. Backend is running\n2. IP address is correct\n3. You are on the same WiFi network`);
    } else {
      throw new Error(error.message);
    }
  }
};

export const predictDisease = classifyMaize;