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
import { formatDistanceToNow } from 'date-fns';

export default function RentalsScreen() {
  const router = useRouter();
  const [rentals, setRentals] = useState<ActiveRental[]>([]);
  const [requests, setRequests] = useState<RentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [rentalsData, requestsData] = await Promise.all([
        api.getRenterRentals(),
        api.getRenterRequests(),
      ]);
      setRentals(rentalsData);
      setRequests(requestsData);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load rentals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePickup = async (rental: ActiveRental) => {
    try {
      await api.pickupRental(rental.rental_id);
      Alert.alert('Success', 'Item picked up! Timer has started.');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleReturn = async (rental: ActiveRental) => {
    Alert.alert(
      'Return Item',
      `Are you sure you want to return "${rental.listing_title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Return',
          style: 'destructive',
          onPress: async () => {
            try {
              const returned = await api.returnRental(rental.rental_id);
              const onTime = returned.penalty_amount === 0;
              Alert.alert(
                'Rental Summary',
                `Base: ₹${returned.listing_price}\n${
                  onTime ? 'Returned on time! +2 trust score.' : `Penalty: ₹${returned.penalty_amount}\nLate return. -5 trust score.`
                }\n\nTotal: ₹${returned.listing_price + returned.penalty_amount}`
              );
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

  const ready = rentals.filter(r => r.status === 'accepted');
  const active = rentals.filter(r => r.status === 'active');
  const history = rentals.filter(r => r.status === 'settled' || r.status === 'returned');
  const pending = requests.filter(r => r.status === 'pending');
  const rejected = requests.filter(r => r.status === 'rejected');

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
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} />
      }
    >
      {/* Ready for Pickup */}
      {ready.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Ready for Pickup</Text>
          {ready.map(rental => (
            <View key={rental.rental_id} style={[styles.card, styles.readyCard]}>
              <Text style={styles.cardTitle}>{rental.listing_title}</Text>
              <Text style={styles.cardSubtitle}>Owner: {rental.owner_name}</Text>
              <Text style={styles.price}>
                ₹{rental.listing_price} / {rental.listing_unit === 'daily' ? 'day' : 'hour'}
              </Text>
              <TouchableOpacity style={styles.pickupButton} onPress={() => handlePickup(rental)}>
                <Ionicons name="walk" size={20} color="#FFF" />
                <Text style={styles.pickupButtonText}>Item Picked Up</Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}

      {/* Active Rentals */}
      {active.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Active Rentals</Text>
          {active.map(rental => (
            <ActiveRentalCard
              key={rental.rental_id}
              rental={rental}
              onReturn={() => handleReturn(rental)}
              onOpenChat={() => handleOpenChat(rental)}
            />
          ))}
        </>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Pending Requests</Text>
          {pending.map(req => (
            <View key={req.request_id} style={styles.card}>
              <Text style={styles.cardTitle}>{req.listing_title}</Text>
              <Text style={styles.cardSubtitle}>Owner: {req.owner_name}</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Pending</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* Rejected */}
      {rejected.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Rejected</Text>
          {rejected.map(req => (
            <View key={req.request_id} style={[styles.card, styles.rejectedCard]}>
              <Text style={styles.cardTitle}>{req.listing_title}</Text>
              <Text style={styles.cardSubtitle}>Owner: {req.owner_name}</Text>
              <View style={[styles.statusBadge, styles.rejectedBadge]}>
                <Text style={[styles.statusText, styles.rejectedText]}>Rejected</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>History</Text>
          {history.map(rental => (
            <View key={rental.rental_id} style={styles.card}>
              <Text style={styles.cardTitle}>{rental.listing_title}</Text>
              <Text style={styles.cardSubtitle}>
                Base: ₹{rental.listing_price} {rental.penalty_amount > 0 && `| Penalty: ₹${rental.penalty_amount}`}
              </Text>
              <Text style={styles.total}>Total: ₹{rental.listing_price + rental.penalty_amount}</Text>
            </View>
          ))}
        </>
      )}

      {rentals.length === 0 && requests.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="bag-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No rentals yet</Text>
        </View>
      )}
    </ScrollView>
  );
}

// Active Rental Card with Timer
function ActiveRentalCard({
  rental,
  onReturn,
  onOpenChat,
}: {
  rental: ActiveRental;
  onReturn: () => void;
  onOpenChat: () => void;
}) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    const updateElapsed = () => {
      const start = new Date(rental.start_time);
      const now = new Date();
      const diff = now.getTime() - start.getTime();
      const hours = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [rental.start_time]);

  const baseHours = rental.base_duration_hours;
  const elapsedHours = (new Date().getTime() - new Date(rental.start_time).getTime()) / 3600000;
  const isOvertime = elapsedHours > baseHours;

  return (
    <View style={[styles.card, styles.activeCard]}>
      <Text style={styles.cardTitle}>{rental.listing_title}</Text>

      <View style={styles.timerContainer}>
        <Ionicons name="timer-outline" size={20} color={isOvertime ? '#EF4444' : '#2563EB'} />
        <Text style={[styles.timer, isOvertime && styles.timerOvertime]}>{elapsed}</Text>
      </View>

      {isOvertime && (
        <Text style={styles.warningText}>⚠️ Overtime! Penalty charges accumulating</Text>
      )}

      <Text style={styles.cardSubtitle}>
        Base: {rental.listing_unit === 'daily' ? '1 day' : '1 hour'} · ₹{rental.listing_price}
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.chatButton} onPress={onOpenChat}>
          <Ionicons name="chatbubble-outline" size={18} color="#2563EB" />
          <Text style={styles.chatButtonText}>Chat</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.returnButton} onPress={onReturn}>
          <Text style={styles.returnButtonText}>Return Item</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  readyCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#10B981',
  },
  activeCard: {
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  rejectedCard: {
    backgroundColor: '#FEF2F2',
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
  statusBadge: {
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  rejectedBadge: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },
  rejectedText: {
    color: '#EF4444',
  },
  total: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 4,
  },
  pickupButton: {
    flexDirection: 'row',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pickupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  timer: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    fontVariant: ['tabular-nums'],
  },
  timerOvertime: {
    color: '#EF4444',
  },
  warningText: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  chatButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  chatButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  returnButton: {
    flex: 2,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  returnButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    marginTop: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
});
