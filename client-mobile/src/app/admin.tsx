import * as AuthSession from 'expo-auth-session';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ENTRA_CONFIG, setPendingCodeVerifier } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}/oauth2/v2.0/token`,
};

export default function AdminScreen() {
  const [error, setError] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'elderandroidapp', path: 'redirect' });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: ENTRA_CONFIG.clientId,
      scopes: ['openid', 'profile', 'email', 'User.Read'],
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    discovery
  );

  // Only handling failure/cancel here — a SUCCESSFUL sign-in is completed
  // entirely by redirect.tsx instead, since this screen may not survive
  // the round-trip through the browser (expo-router can reset the
  // navigation stack on deep link, unmounting this screen and losing any
  // state it was holding).
  useEffect(() => {
    if (response?.type === 'error') {
      setError(response.error?.message ?? 'Sign-in was cancelled or failed.');
    } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
      setError('Sign-in was cancelled.');
    }
  }, [response]);

  function handleSignIn() {
    // Stash the PKCE verifier where redirect.tsx can retrieve it once the
    // app reopens — this is the one piece of state that actually needs to
    // survive the trip out to the browser and back.
    if (request?.codeVerifier) {
      setPendingCodeVerifier(request.codeVerifier);
    }
    setError(null);
    promptAsync();
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Elder / Admin Sign-In</Text>
        <Text style={styles.body}>Sign in with your Microsoft account.</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.signInButton, !request && styles.signInButtonDisabled]}
          disabled={!request}
          onPress={handleSignIn}
        >
          <Text style={styles.signInButtonText}>Sign in with Microsoft</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  title: { fontSize: 20, fontWeight: '700', color: COASTAL_BLUE, textAlign: 'center' },
  body: { fontSize: 14, color: '#6b7c88', textAlign: 'center' },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center' },
  signInButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 16,
    minWidth: 220,
  },
  signInButtonDisabled: { opacity: 0.6 },
  signInButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
