import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickRoundRobinElder } from '@/lib/api';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';

const COASTAL_BLUE = '#407DA8';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

// Campus and class date are both derived entirely from the WAC code (see
// code.tsx) — this screen states that back to the member and asks about a
// preferred elder next. There is deliberately no "choose a different
// campus" fallback here anymore: the code is the source of truth.
export default function PreferenceScreen() {
  const { campus, classDate } = useLocalSearchParams<{ campus: string; classDate: string }>();
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function chooseNoPreference() {
    if (!campus) return;
    setAssigning(true);
    setError(null);
    try {
      const elder = await pickRoundRobinElder(campus);
      router.push({
        pathname: '/select-date',
        params: { campus, classDate, elder: elder.name },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign an elder.');
    } finally {
      setAssigning(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            The code you entered indicates that you attended We Are Coastal on "{formatDate(classDate)}" at "
            {campus}". Do you have a preferred elder you would like to meet with?
          </Text>
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <View style={styles.buttons}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push({ pathname: '/select-elder-preference', params: { campus, classDate } })}
          >
            <Text style={styles.primaryButtonText}>Yes</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={chooseNoPreference} disabled={assigning}>
            {assigning ? (
              <ActivityIndicator color={COASTAL_BLUE} />
            ) : (
              <Text style={styles.secondaryButtonText}>No preference</Text>
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
  messageBox: {
    backgroundColor: '#EAF1F6',
    borderLeftWidth: 4,
    borderLeftColor: COASTAL_BLUE,
    borderRadius: 6,
    padding: 16,
    marginBottom: 32,
  },
  messageText: { color: COASTAL_BLUE, fontSize: 16, fontWeight: '600', lineHeight: 22 },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 16 },
  buttons: { gap: 12 },
  primaryButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: { color: COASTAL_BLUE, fontSize: 15, fontWeight: '600' },
});
