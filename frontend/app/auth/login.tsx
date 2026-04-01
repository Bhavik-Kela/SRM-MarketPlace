import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../utils/api';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = '767037586953-nnman1s3mqlcvm18hf8oohupu33vm0kp.apps.googleusercontent.com';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSignIn(response.params.id_token);
    } else if (response?.type === 'error') {
      Alert.alert('Sign In Error', 'Failed to sign in with Google');
      setLoading(false);
    }
  }, [response]);

  const handleGoogleSignIn = async (idToken: string) => {
    try {
      setLoading(true);
      
      // Send ID token to backend for verification
      const user = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id_token: idToken }),
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Authentication failed');
        return res.json();
      });

      setUser(user);
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Auth error:', error);
      Alert.alert('Error', 'Failed to authenticate with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/grabit-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.subtitle}>College-only rentals</Text>

        <View style={styles.spacer} />

        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={() => {
            setLoading(true);
            promptAsync();
          }}
          disabled={loading || !request}
        >
          {loading ? (
            <ActivityIndicator color="#2563EB" />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color="#2563EB" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
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
  logoContainer: {
    alignSelf: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 200,
    height: 120,
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
  googleButtonDisabled: {
    opacity: 0.5,
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
