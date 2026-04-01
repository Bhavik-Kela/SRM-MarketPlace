import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { api } from '../../utils/api';
import { ChatMessage, ActiveRental } from '../../types';
import { useAuthStore } from '../../store/authStore';
import { formatDistanceToNow } from 'date-fns';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function ChatScreen() {
  const router = useRouter();
  const { rentalId } = useLocalSearchParams<{ rentalId: string }>();
  const { user } = useAuthStore();
  
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rental, setRental] = useState<ActiveRental | null>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!rentalId) return;

    loadData();
    connectSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave_rental', { rental_id: rentalId });
        socketRef.current.disconnect();
      }
    };
  }, [rentalId]);

  const loadData = async () => {
    try {
      // Load rental details and messages
      const [renterRentals, ownerRentals] = await Promise.all([
        api.getRenterRentals(),
        api.getOwnerRentals(),
      ]);
      
      const allRentals = [...renterRentals, ...ownerRentals];
      const currentRental = allRentals.find(r => r.rental_id === rentalId);
      
      if (!currentRental) {
        Alert.alert('Error', 'Rental not found');
        router.back();
        return;
      }
      
      setRental(currentRental);
      
      const messagesData = await api.getChatMessages(rentalId);
      setMessages(messagesData);
    } catch (error) {
      console.error('Error loading chat:', error);
      Alert.alert('Error', 'Failed to load chat');
    } finally {
      setLoading(false);
    }
  };

  const connectSocket = () => {
    const socket = io(API_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('join_rental', { rental_id: rentalId });
    });

    socket.on('new_message', (newMessage: ChatMessage) => {
      setMessages(prev => [...prev, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current = socket;
  };

  const handleSend = async () => {
    if (!message.trim() || sending) return;

    const messageText = message.trim();
    setMessage('');
    setSending(true);

    try {
      await api.sendChatMessage(rentalId, messageText);
      // Message will be added via Socket.IO event
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send message');
      setMessage(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.sender_user_id === user?.user_id;
    
    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessageContainer : styles.theirMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessage : styles.theirMessage,
          ]}
        >
          {!isMyMessage && (
            <Text style={styles.senderName}>{item.sender_name}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.theirMessageText,
            ]}
          >
            {item.message}
          </Text>
          <Text
            style={[
              styles.timestamp,
              isMyMessage ? styles.myTimestamp : styles.theirTimestamp,
            ]}
          >
            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {rental?.listing_title}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {rental?.renter_user_id === user?.user_id
              ? `Owner: ${rental?.owner_name}`
              : `Renter: ${rental?.renter_name}`}
          </Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.message_id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubtext}>Start the conversation!</Text>
          </View>
        }
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={500}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!message.trim() || sending) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!message.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Ionicons name="send" size={20} color="#FFF" />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: 12,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  theirMessageContainer: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    borderRadius: 16,
    padding: 12,
  },
  myMessage: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: '#FFF',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#FFF',
  },
  theirMessageText: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  myTimestamp: {
    color: '#EEF2FF',
  },
  theirTimestamp: {
    color: '#94A3B8',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
