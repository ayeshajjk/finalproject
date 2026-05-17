import React, { createContext, useState, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { supabase } from '../config/supabase';
import { useAuth } from './AuthContext';

const ThemeContext = createContext({});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const systemColorScheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadThemePreference();
    } else {
      setIsDarkMode(systemColorScheme === 'dark');
      setLoading(false);
    }
  }, [user]);

  const loadThemePreference = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('dark_theme')
        .eq('id', user.id)
        .single();

      if (data) {
        setIsDarkMode(data.dark_theme || false);
      } else {
        setIsDarkMode(systemColorScheme === 'dark');
      }
    } catch (error) {
      console.error('Error loading theme:', error);
      setIsDarkMode(systemColorScheme === 'dark');
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ dark_theme: newTheme, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const setTheme = async (darkMode) => {
    setIsDarkMode(darkMode);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ dark_theme: darkMode, updated_at: new Date().toISOString() })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  };

  const theme = {
    // Background colors
    background: isDarkMode ? '#111827' : '#F9FAFB',
    surface: isDarkMode ? '#1F2937' : '#FFFFFF',
    card: isDarkMode ? '#374151' : '#FFFFFF',
    
    // Text colors
    text: isDarkMode ? '#F9FAFB' : '#1F2937',
    textSecondary: isDarkMode ? '#D1D5DB' : '#6B7280',
    textTertiary: isDarkMode ? '#9CA3AF' : '#9CA3AF',
    
    // Primary colors
    primary: '#10B981',
    primaryDark: '#059669',
    primaryLight: '#34D399',
    
    // Accent colors
    accent: isDarkMode ? '#3B82F6' : '#2563EB',
    accentLight: isDarkMode ? '#60A5FA' : '#3B82F6',
    
    // Status colors
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',
    
    // Border colors
    border: isDarkMode ? '#374151' : '#E5E7EB',
    borderLight: isDarkMode ? '#4B5563' : '#F3F4F6',
    
    // Input colors
    inputBackground: isDarkMode ? '#374151' : '#F9FAFB',
    inputBorder: isDarkMode ? '#4B5563' : '#E5E7EB',
    inputPlaceholder: isDarkMode ? '#9CA3AF' : '#9CA3AF',
    
    // Shadow
    shadowColor: isDarkMode ? '#000000' : '#000000',
    
    // Status bar
    statusBarStyle: isDarkMode ? 'light-content' : 'dark-content',
    
    // Component specific
    headerBackground: isDarkMode ? '#1F2937' : '#18392B',
    cardShadow: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.1)',
    
    // Gradients
    gradientPrimary: isDarkMode ? ['#059669', '#047857'] : ['#10B981', '#059669'],
    gradientSecondary: isDarkMode ? ['#1E40AF', '#1E3A8A'] : ['#3B82F6', '#2563EB'],
    gradientDark: isDarkMode ? ['#374151', '#1F2937'] : ['#18392B', '#14452F'],
  };

  const value = {
    isDarkMode,
    theme,
    toggleTheme,
    setTheme,
    loading,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};