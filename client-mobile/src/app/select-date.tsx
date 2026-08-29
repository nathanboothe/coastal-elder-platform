import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { submitSundayOptOut } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

// The "When can you meet?" gate — positioned after an elder is chosen
// (manually, or via round-robin) and before the real availability window,
// since all bookable slots are currently Sunday-only. "I can't meet on a
// Sunday" diverts to the opt-out form unchanged; "Sunday" moves straight
// to that elder's next-two-weeks availability rather than a separate
// date-picking step.
export default function SundayCheckScreen() {
  const { campus, classDate, elder } = useLocalSearchParams<{
    campus: string;
    classDate: string;
    elder: string;
  }>();
  const router = useRouter();
  const [mode, setMode] = useState<'choose' | 'cant-meet'>('choose');

  const [optOutName, setOptOutName] = useState('');
  const [optOutEmail, setOptOutEmail] = useState('');
  const [optOutNotes, setOptOutNotes] = useState('');
  const [optOutSubmitting, setOptOutSubmitting] = useState(false);
  const [optOutError, setOptOutError] = useState<string | null>(null);
  const [optOutSubmitted, setOptOutSubmitted] = useState(false);

  async function handleOptOutSubmit() {
    if (!campus) return;
    if (!optOutName.trim() || !optOutEmail.trim()) {
      setOptOutError('Please enter your name and email.');
      return;
    }
    setOptOutSubmitting(true);
    setOptOutError(null);
    try {
      await submitSundayOptOut({
        campusName: campus,
        memberName: optOutName.trim(),
        memberEmail: optOutEmail.trim(),
        notes: optOutNotes.trim() || undefined,
      });
      setOptOutSubmitted(true);
    } catch (err) {
      setOptOutError(err instanceof Error ? err.message : 'Failed to submit your request.');
    } finally {
      setOptOutSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: campus ?? 'When Can You Meet?' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          {campus}
          {elder ? ` — with ${elder}` : ''}
        </Text>
        <Text style={styles.title}>When can you meet?</Text>

        {mode === 'choose' && (
          <View style={styles.choiceRow}>
            <Pressable
              style={styles.choiceButton}
              onPress={() =>
                router.push({ pathname: '/availability-window', params: { campus, classDate, elder } })
              }
            >
              <Text style={styles.choiceButtonText}>Sunday</Text>
            </Pressable>
            <Pressable style={styles.choiceButtonOutline} onPress={() => setMode('cant-meet')}>
              <Text style={styles.choiceButtonOutlineText}>I can't meet on a Sunday</Text>
            </Pressable>
          </View>
        )}

        {mode === 'cant-meet' && !optOutSubmitted && (
          <View style={styles.optOutBox}>
            <Text style={styles.optOutIntro}>
              No problem — leave your info below and someone from Coastal will reach out to
              schedule a time that works for you.
            </Text>

            <TextInput
              style={styles.input}
              value={optOutName}
              onChangeText={(t) => {
                setOptOutName(t);
                setOptOutError(null);
              }}
              placeholder="Full name"
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={optOutEmail}
              onChangeText={(t) => {
                setOptOutEmail(t);
                setOptOutError(null);
              }}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={optOutNotes}
              onChangeText={setOptOutNotes}
              placeholder="Anything else we should know? (optional)"
              multiline
            />

            {optOutError && <Text style={styles.errorText}>{optOutError}</Text>}

            <Pressable
              style={[styles.optOutButton, optOutSubmitting && styles.optOutButtonDisabled]}
              onPress={handleOptOutSubmit}
              disabled={optOutSubmitting}
            >
              {optOutSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.optOutButtonText}>Submit Request</Text>
              )}
            </Pressable>
          </View>
        )}

        {mode === 'cant-meet' && optOutSubmitted && (
          <View style={styles.optOutBox}>
            <Text style={styles.optOutIntro}>
              Thanks! Someone from Coastal will reach out to schedule a time that works for you.
            </Text>
            <Pressable style={styles.optOutButton} onPress={() => router.replace('/')}>
              <Text style={styles.optOutButtonText}>Done</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  subtitle: { textAlign: 'center', color: '#6b7c88', fontSize: 14, marginBottom: 4 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorText: { color: '#c0392b', textAlign: 'center', fontSize: 13 },
  choiceRow: { gap: 12 },
  choiceButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  choiceButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  choiceButtonOutline: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  choiceButtonOutlineText: { color: COASTAL_BLUE, fontSize: 15, fontWeight: '600' },
  optOutBox: {
    backgroundColor: '#EAF1F6',
    borderLeftWidth: 4,
    borderLeftColor: COASTAL_BLUE,
    borderRadius: 6,
    padding: 16,
    gap: 10,
  },
  optOutIntro: { color: COASTAL_BLUE, fontWeight: '600', fontSize: 14, lineHeight: 20 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#fff',
  },
  notesInput: { minHeight: 70, textAlignVertical: 'top' },
  optOutButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  optOutButtonDisabled: { opacity: 0.7 },
  optOutButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
