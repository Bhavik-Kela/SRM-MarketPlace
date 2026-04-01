import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function Index() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Check for session_id in URL hash (OAuth callback)
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      router.replace('/auth/callback');
      return;
    }

    // Wait for auth state to be determined
    if (isAuthenticated === null) return;

    const inAuthGroup = segments[0] === 'auth';

    if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (!isAuthenticated && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (isAuthenticated && !inAuthGroup && segments.length === 0) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#2563EB" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
});
