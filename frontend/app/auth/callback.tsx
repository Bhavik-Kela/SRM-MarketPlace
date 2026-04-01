import { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

export default function AuthCallback() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double processing in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processCallback = async () => {
      try {
        // Extract session_id from URL hash
        const hash = typeof window !== 'undefined' ? window.location.hash : '';
        const params = new URLSearchParams(hash.substring(1));
        const sessionId = params.get('session_id');

        if (!sessionId) {
          console.error('No session_id found');
          router.replace('/auth/login');
          return;
        }

        // Exchange session_id for user data
        const user = await api.createSession(sessionId);
        
        // Clear hash from URL
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', window.location.pathname);
        }

        // Set user and navigate to home
        setUser(user);
        router.replace('/(tabs)');
      } catch (error) {
        console.error('Auth callback error:', error);
        router.replace('/auth/login');
      }
    };

    processCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#64748B',
  },
});
