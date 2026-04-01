import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../utils/api';

export default function AddListingScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<'hourly' | 'daily'>('daily');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert('Permission Required', 'Camera roll permission is required');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an item name');
      return;
    }
    
    const priceNum = parseInt(price);
    if (!priceNum || priceNum <= 0) {
      Alert.alert('Error', 'Please enter a valid price');
      return;
    }

    setLoading(true);
    try {
      await api.createListing({
        title: title.trim(),
        description: description.trim() || undefined,
        price: priceNum,
        unit,
        image_base64: imageBase64 || undefined,
      });

      Alert.alert('Success', 'Item listed successfully!');
      router.back();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="close" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List an Item</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {/* Image Picker */}
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageBase64 ? (
            <Image source={{ uri: imageBase64 }} style={styles.imagePreview} />
          ) : (
            <>
              <Ionicons name="image-outline" size={48} color="#94A3B8" />
              <Text style={styles.imagePickerText}>Add Photo (Optional)</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Title */}
        <Text style={styles.label}>Item Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Camping Tent"
          value={title}
          onChangeText={setTitle}
          placeholderTextColor="#94A3B8"
        />

        {/* Description */}
        <Text style={styles.label}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe your item..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          placeholderTextColor="#94A3B8"
        />

        {/* Price */}
        <Text style={styles.label}>Price (₹) *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 250"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
          placeholderTextColor="#94A3B8"
        />

        {/* Rental Type */}
        <Text style={styles.label}>Rental Type *</Text>
        <View style={styles.unitButtons}>
          <TouchableOpacity
            style={[
              styles.unitButton,
              unit === 'hourly' && styles.unitButtonActive,
            ]}
            onPress={() => setUnit('hourly')}
          >
            <Ionicons
              name="time-outline"
              size={20}
              color={unit === 'hourly' ? '#2563EB' : '#64748B'}
            />
            <Text
              style={[
                styles.unitButtonText,
                unit === 'hourly' && styles.unitButtonTextActive,
              ]}
            >
              Per Hour
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.unitButton,
              unit === 'daily' && styles.unitButtonActive,
            ]}
            onPress={() => setUnit('daily')}
          >
            <Ionicons
              name="calendar-outline"
              size={20}
              color={unit === 'daily' ? '#2563EB' : '#64748B'}
            />
            <Text
              style={[
                styles.unitButtonText,
                unit === 'daily' && styles.unitButtonTextActive,
              ]}
            >
              Per Day
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.submitButtonText}>List Item</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  imagePicker: {
    width: '100%',
    height: 160,
    backgroundColor: '#FFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePickerText: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 20,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  unitButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  unitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  unitButtonActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#2563EB',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  unitButtonTextActive: {
    color: '#2563EB',
  },
  submitButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 32,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
