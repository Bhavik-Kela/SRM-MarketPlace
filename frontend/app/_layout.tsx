import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { api } from '../utils/api';

export default function RootLayout() {
  const { setUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // CRITICAL: Skip auth check if returning from OAuth callback
    // AuthCallback will exchange the session_id and establish the session first
    if (typeof window !== 'undefined' && window.location.hash?.includes('session_id=')) {
      return;
    }

    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const user = await api.getMe();
        setUser(user);
      } catch (error) {
        setUser(null);
      }
    };

    checkAuth();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[rentalId]" options={{ presentation: 'modal' }} />
      <Stack.Screen name="listing/add" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
