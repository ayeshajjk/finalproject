import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
 
import EditProfileScreen from '../screens/EditProfileScreen';
// import NotificationsScreen from '../screens/NotificationsScreen';
import PrivacyScreen from '../screens/PrivacyScreen';
import TermsScreen from '../screens/TermsScreen';
import HelpCenterScreen from '../screens/HelpCenterScreen';
import AboutScreen from '../screens/AboutScreen';
import SplashScreen from '../screens/SplashScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HistoryScreen from '../screens/HistoryScreen';
import ScanScreen from '../screens/ScanScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Custom Tab Bar Component
const CustomTabBar = ({ state, descriptors, navigation }) => {
  return (
    <View style={tabBarStyles.container}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = route.name;
        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Icon configuration
        let IconComponent;
        let iconName;

        if (route.name === 'Scan') {
          IconComponent = MaterialCommunityIcons;
          iconName = 'line-scan';
        } else if (route.name === 'History') {
          IconComponent = Feather;
          iconName = 'clock';
        } else if (route.name === 'Profile') {
          IconComponent = Ionicons;
          iconName = isFocused ? 'person' : 'person-outline';
        }

        const color = isFocused ? '#18392B' : '#9E9E9E';

        // Special styling for Scan button (center)
        if (route.name === 'Scan') {
          return (
            <TouchableOpacity
              key={index}
              onPress={onPress}
              style={tabBarStyles.scanButtonContainer}
            >
              <View style={[
                tabBarStyles.scanButton,
                isFocused && tabBarStyles.scanButtonActive
              ]}>
                <IconComponent 
                  name={iconName} 
                  size={28} 
                  color={isFocused ? '#FFFFFF' : '#18392B'} 
                />
              </View>
              <Text style={[
                tabBarStyles.label,
                { color: isFocused ? '#18392B' : '#9E9E9E' }
              ]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={tabBarStyles.tabButton}
          >
            <IconComponent name={iconName} size={24} color={color} />
            <Text style={[tabBarStyles.label, { color }]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const tabBarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8F5E9',
    height: 70,
    paddingBottom: 10,
    paddingTop: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  scanButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#18392B',
  },
  scanButtonActive: {
    backgroundColor: '#18392B',
    borderColor: '#1B5E20',
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});

// Tab Navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Scan" component={ScanScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { user, loading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {user ? (
          <>
            {/* Main Tab Navigation */}
            <Stack.Screen
              name="Main"
              component={TabNavigator}
              options={{ headerShown: false }}
            />
            
            {/* Edit Profile Screen */}
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }}
            />
            
            {/* Settings Screen */}
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{
                headerShown: false,
                headerStyle: {
                  backgroundColor: '#18392B',
                },
                headerTintColor: '#FFFFFF',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
                headerBackTitleVisible: false,
              }}
            />
            
            {/* Notifications Screen */}
             {/* Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }} */ }
            
            
            {/* Privacy & Security Screen */}
            <Stack.Screen
              name="Privacy"
              component={PrivacyScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }}
            />
            
            {/* Terms & Privacy Screen */}
            <Stack.Screen
              name="Terms"
              component={TermsScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }}
            />
            
            {/* Help Center Screen */}
            <Stack.Screen
              name="HelpCenter"
              component={HelpCenterScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }}
            />
            
            {/* About Screen */}
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ 
                headerShown: false,
                presentation: 'card',
              }}
            />
          </>
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#18392B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default AppNavigator;