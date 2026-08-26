import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { loginWithCode } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function CodeEntryScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!code.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const { campus, classDate } = await loginWithCode(code.trim());
      router.push({ pathname: '/confirm-campus', params: { campus, classDate } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code wasn't recognized.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Enter Your Code</Text>
        <Text style={styles.subtitle}>
          This is the code you received at your We Are Coastal class.
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, error && styles.inputError]}
            value={code}
            onChangeText={(text) => {
              setCode(text);
              setError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="Class code"
            maxLength={20}
          />
          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Continue</Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7c88',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  form: { gap: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    letterSpacing: 2,
    textAlign: 'center',
  },
  inputError: { borderColor: '#c0392b' },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center' },
  submitButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: { opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
