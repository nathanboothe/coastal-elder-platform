import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitContactEngagement } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function EngagementScreen() {
  const { campus } = useLocalSearchParams<{ campus: string }>();
  const router = useRouter();

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (!campus) return;
    if (!memberName.trim() || !memberEmail.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitContactEngagement({
        campusName: campus,
        memberName: memberName.trim(),
        memberEmail: memberEmail.trim(),
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit your request.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Stack.Screen options={{ title: 'Request Sent' }} />
        <View style={styles.container}>
          <Text style={styles.title}>thank you</Text>
          <Text style={styles.subtitle}>
            Our engagement team will follow up to help find a time that works.
          </Text>
          <Pressable style={styles.submitButton} onPress={() => router.replace('/')}>
            <Text style={styles.submitButtonText}>done</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Contact Engagement' }} />
      <View style={styles.container}>
        <Text style={styles.title}>let us know how to reach you</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            value={memberName}
            onChangeText={(t) => {
              setMemberName(t);
              setError(null);
            }}
            placeholder="Full name"
            autoCapitalize="words"
          />
          <TextInput
            style={styles.input}
            value={memberEmail}
            onChangeText={(t) => {
              setMemberEmail(t);
              setError(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            style={[styles.input, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            placeholder="What would help? (optional)"
            multiline
          />

          {error && <Text style={styles.errorText}>{error}</Text>}

          <Pressable
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>submit</Text>}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COASTAL_BLUE, textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 14, color: '#6b7c88', textAlign: 'center', marginBottom: 32 },
  form: { gap: 10 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },
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
