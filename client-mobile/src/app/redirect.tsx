import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ENTRA_CONFIG, loginWithEntraIdToken, takePendingCodeVerifier } from '@/lib/api';

// See comment in admin.tsx: this screen — not admin.tsx — is the one
// guaranteed to actually be mounted at the moment Entra redirects back
// into the app, so it owns finishing the sign-in: reading the
// authorization code straight from the URL, exchanging it for tokens
// itself, and handing the result to the backend. It does not depend on
// admin.tsx's React state having survived the round-trip.
WebBrowser.maybeCompleteAuthSession();

const COASTAL_BLUE = '#407DA8';

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${ENTRA_CONFIG.tenantId}/oauth2/v2.0/token`,
};

export default function RedirectScreen() {
  const { code, error: authError } = useLocalSearchParams<{ code?: string; error?: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const handledRef = useRef(false); // guards against double-exchange (auth codes are single-use)

  useEffect(() => {
    if (handledRef.current) return;

    if (authError) {
      handledRef.current = true;
      setError(`Sign-in failed: ${authError}`);
      return;
    }

    if (code) {
      handledRef.current = true;
      completeSignIn(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, authError]);

  async function completeSignIn(authCode: string) {
    const codeVerifier = takePendingCodeVerifier();
    if (!codeVerifier) {
      setError('Sign-in session expired. Please try again.');
      return;
    }

    try {
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'elderandroidapp', path: 'redirect' });

      const tokenResult = await AuthSession.exchangeCodeAsync(
        {
          clientId: ENTRA_CONFIG.clientId,
          code: authCode,
          redirectUri,
          extraParams: { code_verifier: codeVerifier },
        },
        discovery
      );

      if (!tokenResult.idToken) {
        throw new Error('No ID token returned from sign-in.');
      }

      await loginWithEntraIdToken(tokenResult.idToken);
      router.replace('/admin-home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {!error && <ActivityIndicator size="large" color={COASTAL_BLUE} />}

        {error && (
          <>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => router.replace('/admin')}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, paddingHorizontal: 24 },
  errorText: { color: '#c0392b', fontSize: 14, textAlign: 'center' },
  retryButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  retryButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
