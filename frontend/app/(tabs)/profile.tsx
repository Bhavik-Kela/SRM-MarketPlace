import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';
import { Listing, ActiveRental } from '../../types';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [listingsData, rentalsData] = await Promise.all([
        api.getMyListings(),
        api.getRenterRentals(),
      ]);
      setListings(listingsData);
      setRentals(rentalsData);
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.logout();
            logout();
            router.replace('/auth/login');
          } catch (error) {
            console.error('Logout error:', error);
          }
        },
      },
    ]);
  };

  if (!user) return null;

  const activeRentals = rentals.filter(r => r.status === 'active').length;
  const completedRentals = rentals.filter(r => r.status === 'settled').length;

  const trustColor =
    user.trust_score >= 80
      ? '#10B981'
      : user.trust_score >= 50
      ? '#F59E0B'
      : '#EF4444';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* User Info */}
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user.name[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.email}>{user.email}</Text>
      </View>

      {/* Trust Score */}
      <View style={styles.trustCard}>
        <Text style={styles.trustLabel}>Trust Score</Text>
        <View style={styles.trustRow}>
          <Ionicons name="shield" size={28} color={trustColor} />
          <Text style={[styles.trustScore, { color: trustColor }]}>
            {user.trust_score} / 100
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${user.trust_score}%`, backgroundColor: trustColor },
            ]}
          />
        </View>
        <Text style={styles.trustHint}>
          {user.trust_score >= 80
            ? '🟢 Excellent — keep returning on time!'
            : user.trust_score >= 50
            ? '🟡 Good — a few late returns may have affected this'
            : '🔴 Low — late returns reduce your trust score'}
        </Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Ionicons name="cube-outline" size={22} color="#2563EB" />
          <Text style={styles.statValue}>{listings.length}</Text>
          <Text style={styles.statLabel}>Items Listed</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="time-outline" size={22} color="#2563EB" />
          <Text style={styles.statValue}>{activeRentals}</Text>
          <Text style={styles.statLabel}>Active Rentals</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={22} color="#2563EB" />
          <Text style={styles.statValue}>{completedRentals}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#FFF',
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#64748B',
  },
  trustCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  trustLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  trustScore: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  trustHint: {
    fontSize: 13,
    color: '#64748B',
  },
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 32,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    borderWidth: 2,
    borderColor: '#EF4444',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
});
