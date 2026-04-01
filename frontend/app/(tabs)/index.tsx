import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../../utils/api';
import { Listing } from '../../types';
import { useAuthStore } from '../../store/authStore';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [listings, setListings] = useState<Listing[]>([]);
  const [filteredListings, setFilteredListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [availableOnly, setAvailableOnly] = useState(true);
  const [sortBy, setSortBy] = useState<'low' | 'high'>('low');

  const loadListings = useCallback(async () => {
    try {
      const data = await api.getListings();
      // Filter out user's own listings
      const filtered = data.filter(l => l.owner_user_id !== user?.user_id);
      setListings(filtered);
      applyFilters(filtered, search, availableOnly, sortBy);
    } catch (error) {
      console.error('Error loading listings:', error);
      Alert.alert('Error', 'Failed to load listings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, search, availableOnly, sortBy]);

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    applyFilters(listings, search, availableOnly, sortBy);
  }, [search, availableOnly, sortBy, listings]);

  const applyFilters = (
    data: Listing[],
    searchText: string,
    showAvailableOnly: boolean,
    sort: 'low' | 'high'
  ) => {
    let result = [...data];

    // Search filter
    if (searchText.trim()) {
      result = result.filter(l =>
        l.title.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Available filter
    if (showAvailableOnly) {
      result = result.filter(l => l.available);
    }

    // Sort by price
    result.sort((a, b) =>
      sort === 'low' ? a.price - b.price : b.price - a.price
    );

    setFilteredListings(result);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadListings();
  };

  const handleRent = async (listing: Listing) => {
    if (!listing.available) {
      Alert.alert('Unavailable', 'This item is currently unavailable');
      return;
    }

    Alert.alert(
      'Confirm Rent Request',
      `Send rent request for "${listing.title}"?\n\n₹${listing.price} / ${listing.unit}\nOwner: ${listing.owner_name}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Request',
          onPress: async () => {
            try {
              await api.createRentRequest(listing.listing_id);
              Alert.alert(
                'Request Sent',
                `Your rent request for "${listing.title}" has been sent. Check notifications for updates.`
              );
              loadListings();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to send request');
            }
          },
        },
      ]
    );
  };

  const renderListing = ({ item }: { item: Listing }) => (
    <View style={styles.card}>
      {item.image_base64 && (
        <Image
          source={{ uri: item.image_base64 }}
          style={styles.image}
          resizeMode="cover"
        />
      )}
      {!item.image_base64 && (
        <View style={[styles.image, styles.placeholderImage]}>
          <Ionicons name="image-outline" size={40} color="#94A3B8" />
        </View>
      )}

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.available && (
            <View style={styles.unavailableBadge}>
              <Text style={styles.unavailableText}>Unavailable</Text>
            </View>
          )}
        </View>

        <Text style={styles.price}>
          ₹{item.price} / {item.unit === 'daily' ? 'day' : 'hour'}
        </Text>

        <Text style={styles.owner} numberOfLines={1}>
          Owner: {item.owner_name}
        </Text>

        {item.description && (
          <Text style={styles.description} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <TouchableOpacity
          style={[styles.rentButton, !item.available && styles.rentButtonDisabled]}
          onPress={() => handleRent(item)}
          disabled={!item.available}
        >
          <Text style={styles.rentButtonText}>Rent</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search items..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94A3B8"
        />
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setSortBy(sortBy === 'low' ? 'high' : 'low')}
        >
          <Ionicons name="swap-vertical" size={16} color="#2563EB" />
          <Text style={styles.filterButtonText}>
            {sortBy === 'low' ? 'Low → High' : 'High → Low'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterButton,
            availableOnly && styles.filterButtonActive,
          ]}
          onPress={() => setAvailableOnly(!availableOnly)}
        >
          <Ionicons
            name={availableOnly ? 'checkbox' : 'square-outline'}
            size={16}
            color={availableOnly ? '#2563EB' : '#64748B'}
          />
          <Text
            style={[
              styles.filterButtonText,
              availableOnly && styles.filterButtonTextActive,
            ]}
          >
            Available only
          </Text>
        </TouchableOpacity>
      </View>

      {/* Listings */}
      <FlatList
        data={filteredListings}
        renderItem={renderListing}
        keyExtractor={(item) => item.listing_id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#2563EB"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No items found</Text>
          </View>
        }
      />

      {/* Add Item FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/listing/add')}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>
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
    backgroundColor: '#F8FAFC',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    margin: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  filterButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2563EB',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#2563EB',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#F1F5F9',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 8,
  },
  unavailableBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  unavailableText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 6,
  },
  owner: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  rentButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  rentButtonDisabled: {
    backgroundColor: '#CBD5E1',
  },
  rentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: '#94A3B8',
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
