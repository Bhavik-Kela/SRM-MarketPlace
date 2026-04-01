import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { ActiveRental, RentRequest } from '../../types';

export default function DashboardScreen() {
  const router = useRouter();
  const [requests, setRequests] = useState<RentRequest[]>([]);
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [requestsData, rentalsData] = await Promise.all([
        api.getOwnerRequests(),
        api.getOwnerRentals(),
      ]);
      setRequests(requestsData);
      setRentals(rentalsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAccept = async (request: RentRequest) => {
    try {
      await api.acceptRequest(request.request_id);
      Alert.alert('Success', `Accepted request for "${request.listing_title}"`);
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReject = async (request: RentRequest) => {
    Alert.alert(
      'Reject Request',
      `Are you sure you want to reject the request for "${request.listing_title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.rejectRequest(request.request_id);
              Alert.alert('Rejected', `Request for "${request.listing_title}" rejected`);
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const handleOpenChat = (rental: ActiveRental) => {
    router.push(`/chat/${rental.rental_id}`);
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const activeRentals = rentals.filter(r => r.status === 'active' || r.status === 'accepted');

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadData();
          }}
        />
      }
    >
      {/* Pending Requests */}
      <Text style={styles.sectionTitle}>Pending Requests</Text>
      {pendingRequests.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="inbox-outline" size={32} color="#CBD5E1" />
          <Text style={styles.emptyText}>No pending requests</Text>
        </View>
      ) : (
        pendingRequests.map(req => (
          <View key={req.request_id} style={styles.card}>
            <Text style={styles.cardTitle}>{req.listing_title}</Text>
            <Text style={styles.cardSubtitle}>Requested by: {req.renter_name}</Text>
            <Text style={styles.price}>
              ₹{req.listing_price} / {req.listing_unit === 'daily' ? 'day' : 'hour'}
            </Text>
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.rejectButton}
                onPress={() => handleReject(req)}
              >
                <Text style={styles.rejectButtonText}>Reject</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={() => handleAccept(req)}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {/* Active Rentals */}
      <Text style={styles.sectionTitle}>Active Rentals (Your Items)</Text>
      {activeRentals.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="briefcase-outline" size={32} color="#CBD5E1" />
          <Text style={styles.emptyText}>No active rentals</Text>
        </View>
      ) : (
        activeRentals.map(rental => (
          <View key={rental.rental_id} style={[styles.card, styles.activeCard]}>
            <Text style={styles.cardTitle}>{rental.listing_title}</Text>
            <Text style={styles.cardSubtitle}>Renter: {rental.renter_name}</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>
                {rental.status === 'accepted' ? 'Waiting for pickup' : 'Active — timer running'}
              </Text>
            </View>
            {rental.status === 'active' && (
              <TouchableOpacity
                style={styles.chatButton}
                onPress={() => handleOpenChat(rental)}
              >
                <Ionicons name="chatbubble-outline" size={18} color="#2563EB" />
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </TouchableOpacity>
            )}
          </View>
        ))
      )}
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  card: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activeCard: {
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  emptyCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  statusBadge: {
    backgroundColor: '#EEF2FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 8,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
});
