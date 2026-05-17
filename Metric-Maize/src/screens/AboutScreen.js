import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  StatusBar,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const AboutScreen = ({ navigation }) => {
  const features = [
    {
      icon: 'zap',
      color: '#F59E0B',
      title: 'AI-Powered Analysis',
      description: 'Advanced machine learning for accurate maize classification',
    },
    {
      icon: 'shield',
      color: '#10B981',
      title: 'Secure & Private',
      description: 'End-to-end encryption keeps your data safe',
    },
    {
      icon: 'trending-up',
      color: '#3B82F6',
      title: 'Real-time Results',
      description: 'Instant grading and quality assessment',
    },
    {
      icon: 'globe',
      color: '#8B5CF6',
      title: 'Cloud Sync',
      description: 'Access your data anywhere, anytime',
    },
  ];

  const team = [
    { role: 'Engineering & AI Research', name: 'Core Engineering Team' },
    { role: 'Design & User Experience', name: 'UX/UI Team' },
    { role: 'Customer Support', name: 'Customer Success Team' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <LinearGradient
        colors={['#10B981', '#059669']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-left" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>About Maize Metric</Text>
            <Text style={styles.headerSubtitle}>Know more about us</Text>
          </View>
          <View style={styles.headerIconContainer}>
            <Ionicons name="leaf" size={28} color="#FFFFFF" />
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* App Logo & Info */}
        <View style={styles.appInfo}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.appLogoGradient}
          >
            <Ionicons name="leaf" size={64} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.appName}>Maize Metric</Text>
          <Text style={styles.appTagline}>
            AI-Powered Maize Classification
          </Text>
          <View style={styles.versionBadge}>
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </View>

        {/* Mission Statement */}
        <View style={styles.section}>
          <LinearGradient
            colors={['#18392B', '#14452F']}
            style={styles.missionCard}
          >
            <Text style={styles.missionTitle}>Our Mission</Text>
            <Text style={styles.missionText}>
              Empowering farmers and agricultural professionals with cutting-edge AI technology to improve maize quality assessment, increase efficiency, and promote sustainable farming practices worldwide.
            </Text>
          </LinearGradient>
        </View>

        {/* Key Features */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Key Features</Text>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <View style={[styles.featureIcon, { backgroundColor: `${feature.color}15` }]}>
                  <Feather name={feature.icon} size={28} color={feature.color} />
                </View>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Team */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Team</Text>
          <View style={styles.card}>
            {team.map((member, index) => (
              <React.Fragment key={index}>
                <View style={styles.teamMember}>
                  <View style={styles.teamIcon}>
                    <Feather name="users" size={20} color="#10B981" />
                  </View>
                  <View style={styles.teamInfo}>
                    <Text style={styles.teamRole}>{member.role}</Text>
                    <Text style={styles.teamName}>{member.name}</Text>
                  </View>
                </View>
                {index < team.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Contact Us */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.linkItem}
              onPress={() => Linking.openURL('mailto:maizemetric2026@gmail.com')}
            >
              <View style={styles.linkLeft}>
                <View style={styles.linkIcon}>
                  <Feather name="mail" size={20} color="#10B981" />
                </View>
                <Text style={styles.linkTitle}>maizemetric2026@gmail.com</Text>
              </View>
              <Feather name="external-link" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Copyright */}
        <View style={styles.copyright}>
          <Ionicons name="leaf" size={24} color="#10B981" />
          <Text style={styles.copyrightText}>
            © 2026 Maize Metric Inc.
          </Text>
          <Text style={styles.copyrightSubtext}>
            All rights reserved
          </Text>
          <Text style={styles.copyrightSubtext}>
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
  header: {
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
  appInfo: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
  },
  appLogoGradient: {
    width: 120,
    height: 120,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 5,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#18392B',
    marginBottom: 8,
  },
  appTagline: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 16,
  },
  versionBadge: {
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
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
  missionCard: {
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  missionText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 22,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  featureIcon: {
    width: 70,
    height: 70,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 6,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
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
  teamMember: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  teamIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  teamInfo: {
    flex: 1,
  },
  teamRole: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  teamName: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  linkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  linkTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 72,
  },
  copyright: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  copyrightText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#18392B',
    marginTop: 12,
  },
  copyrightSubtext: {
    fontSize: 13,
    color: '#9CA3AF',
    marginTop: 4,
  },
});

export default AboutScreen;