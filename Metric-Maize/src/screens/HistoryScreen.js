import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Feather, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../config/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';

const HistoryScreen = () => {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ✅ Re-fetch every time the screen is focused
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [user])
  );

  // ✅ Real-time Supabase subscription for live updates
  useEffect(() => {
    if (!user) return;

    const subscription = supabase
      .channel('scan_history_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'scan_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('Real-time change detected:', payload.eventType);

          if (payload.eventType === 'INSERT') {
            setHistory((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setHistory((prev) =>
              prev.filter((item) => item.id !== payload.old.id)
            );
          } else if (payload.eventType === 'UPDATE') {
            setHistory((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? payload.new : item
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const loadHistory = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data, error } = await supabase
        .from('scan_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', sixMonthsAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading history:', error);
        Alert.alert('Error', 'Could not load history');
      } else {
        console.log('Loaded history:', data?.length || 0, 'items');
        setHistory(data || []);
      }
    } catch (error) {
      console.error('Exception loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const handleDeleteAll = () => {
    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to delete all scan history? This action cannot be undone.')) {
        deleteAllHistory();
      }
    } else {
      Alert.alert(
        'Delete All History',
        'Are you sure you want to delete all scan history? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete All',
            style: 'destructive',
            onPress: deleteAllHistory,
          },
        ]
      );
    }
  };

  const deleteAllHistory = async () => {
    setDeleting(true);

    try {
      console.log('Deleting all history for user:', user.id);

      const { error } = await supabase
        .from('scan_history')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('Delete error:', error);
        Alert.alert('Error', 'Could not delete history: ' + error.message);
      } else {
        console.log('History deleted successfully');
        setHistory([]);
        if (Platform.OS === 'web') {
          alert('All history deleted successfully!');
        } else {
          Alert.alert('Success', 'All history deleted successfully!');
        }
      }
    } catch (error) {
      console.error('Exception deleting history:', error);
      Alert.alert('Error', 'Error deleting history');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteSingle = (itemId, itemName) => {
    console.log('Delete button pressed for item:', itemId);

    if (Platform.OS === 'web') {
      if (window.confirm(`Delete scan: ${itemName}?`)) {
        deleteSingleItem(itemId);
      }
    } else {
      Alert.alert(
        'Delete Scan',
        `Are you sure you want to delete this scan?\n\n${itemName}`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => deleteSingleItem(itemId),
          },
        ],
        { cancelable: true }
      );
    }
  };

  const deleteSingleItem = async (itemId) => {
    try {
      console.log('Deleting item with ID:', itemId);

      const { error } = await supabase
        .from('scan_history')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Delete error:', error);
        Alert.alert('Error', 'Could not delete item: ' + error.message);
      } else {
        console.log('Item deleted successfully');
        setHistory((prev) => prev.filter((item) => item.id !== itemId));
      }
    } catch (error) {
      console.error('Exception:', error);
      Alert.alert('Error', 'An error occurred while deleting');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      const hours = date.getHours();
      const minutes = date.getMinutes();
      return `Today at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const getGradeColor = (grade) => {
    const gradeColors = {
      'Grade A': ['#10B981', '#059669'],
      'Grade B': ['#3B82F6', '#2563EB'],
      'Grade C': ['#F59E0B', '#D97706'],
      'Grade D': ['#EF4444', '#DC2626'],
    };
    return gradeColors[grade] || ['#6B7280', '#4B5563'];
  };

  const renderHistoryItem = ({ item }) => (
    <View style={styles.historyItem}>
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: getGradeColor(item.grade)[0] }]} />

      {/* Image */}
      <View style={styles.imageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.thumbnail} />
        ) : (
          <View style={styles.placeholderImage}>
            <Ionicons name="image-outline" size={32} color="#A5D6A7" />
          </View>
        )}
      </View>

      {/* Details */}
      <View style={styles.itemDetails}>
        <Text style={styles.classification} numberOfLines={1}>
          {item.classification}
        </Text>

        <LinearGradient
          colors={getGradeColor(item.grade)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.gradeBadge}
        >
          <Ionicons name="ribbon" size={12} color="#FFFFFF" />
          <Text style={styles.gradeText}>{item.grade}</Text>
        </LinearGradient>

        <View style={styles.dateContainer}>
          <Feather name="clock" size={11} color="#9CA3AF" />
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
      </View>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteItemButton}
        onPress={() => {
          console.log('Touch registered on delete button');
          handleDeleteSingle(item.id, item.classification);
        }}
        activeOpacity={0.6}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={18} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Gradient Header */}
      <LinearGradient
        colors={['#18392B', '#14452F']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="history" size={28} color="#FFFFFF" />
            </View>
            <View>
              <Text style={styles.title}>Scan History</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  {/* ✅ Always reflects latest history.length */}
                  <Text style={styles.statNumber}>{history.length}</Text>
                  <Text style={styles.statLabel}>Total Scans</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>6</Text>
                  <Text style={styles.statLabel}>Months</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Delete All Button */}
      {history.length > 0 && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.deleteAllButton, deleting && styles.deleteAllButtonDisabled]}
            onPress={handleDeleteAll}
            disabled={deleting}
            activeOpacity={0.8}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="trash-2" size={16} color="#FFFFFF" />
                <Text style={styles.deleteAllButtonText}>Clear All History</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.centerContent}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#18392B" />
            <Text style={styles.loadingText}>Loading your history...</Text>
          </View>
        </View>
      ) : history.length === 0 ? (
        <View style={styles.centerContent}>
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#E8F5E9', '#C8E6C9']}
              style={styles.emptyIconContainer}
            >
              <MaterialIcons name="history" size={64} color="#18392B" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>No Scans Yet</Text>
            <Text style={styles.emptySubtext}>
              Start scanning maize to build your history.{'\n'}
              All your scans will appear here.
            </Text>
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={18} color="#FFFFFF" />
              <Text style={styles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={history}
          renderItem={renderHistoryItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#18392B']}
              tintColor="#18392B"
            />
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
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
    alignItems: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  deleteAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteAllButtonDisabled: {
    opacity: 0.5,
  },
  deleteAllButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  list: {
    padding: 20,
    paddingTop: 12,
  },
  historyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'visible',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  imageContainer: {
    marginLeft: 8,
    marginRight: 16,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  placeholderImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  itemDetails: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  classification: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  gradeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    gap: 4,
  },
  gradeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  date: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  deleteItemButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
    zIndex: 10,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    maxWidth: 320,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#18392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  emptySubtext: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18392B',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#18392B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  refreshButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});

export default HistoryScreen;