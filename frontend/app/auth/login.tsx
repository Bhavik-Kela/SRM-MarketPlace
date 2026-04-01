import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LoginScreen() {
  const handleGoogleSignIn = async () => {
    try {
      // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
      const redirectUrl = `${API_URL}/auth/callback`;
      const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

      if (Platform.OS === 'web') {
        // For web, use window.location
        if (typeof window !== 'undefined') {
          window.location.href = authUrl;
        }
      } else {
        // For mobile, use WebBrowser
        await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
      }
    } catch (error) {
      console.error('Auth error:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="cube-outline" size={64} color="#2563EB" />
        </View>

        <Text style={styles.title}>GrabIt</Text>
        <Text style={styles.subtitle}>College-only rentals</Text>

        <View style={styles.spacer} />

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Ionicons name="logo-google" size={24} color="#2563EB" />
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          You sign in with Google's own screen. We never ask for your Gmail password.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  iconContainer: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    marginBottom: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#64748B',
  },
  spacer: {
    flex: 1,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    gap: 12,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  disclaimer: {
    fontSize: 13,
    textAlign: 'center',
    color: '#94A3B8',
    marginTop: 16,
    marginBottom: 40,
  },
});
