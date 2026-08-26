import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchElders, type Elder } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function toApiDate(iso: string): string {
  return iso.split('T')[0]; // YYYY-MM-DD, what the backend expects
}

export default function SelectElderScreen() {
  const { campus, date, time } = useLocalSearchParams<{
    campus: string;
    date: string;
    time: string;
  }>();
  const router = useRouter();
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedElder, setSelectedElder] = useState<Elder | null>(null);

  useEffect(() => {
    loadElders();
  }, [campus, date, time]);

  async function loadElders() {
    if (!campus || !date || !time) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchElders(campus, toApiDate(date), time);
      setElders(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Select an Elder' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          {campus} — {formatDate(date)} at {time}
        </Text>
        <Text style={styles.title}>Who would you like to meet with?</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Couldn't load elders. Check your connection and try again.
            </Text>
            <Pressable style={styles.retryButton} onPress={loadElders}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && elders.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              No elders are available at this time. Try a different time slot.
            </Text>
          </View>
        )}

        {!loading && !error && elders.length > 0 && (
          <>
            <View style={styles.elderList}>
              {elders.map((elder) => {
                const isSelected = elder.id === selectedElder?.id;
                return (
                  <Pressable
                    key={elder.id}
                    onPress={() => setSelectedElder(elder)}
                    style={[styles.elderButton, isSelected && styles.elderButtonSelected]}
                  >
                    <Text
                      style={[
                        styles.elderButtonText,
                        isSelected && styles.elderButtonTextSelected,
                      ]}
                    >
                      {elder.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedElder && (
              <View style={styles.confirmation}>
                <Text style={styles.confirmationText}>
                  Meeting with: {selectedElder.name}
                </Text>
              </View>
            )}
          </>
        )}

        <Pressable
          disabled={!selectedElder}
          style={[styles.continueButton, !selectedElder && styles.continueButtonDisabled]}
          onPress={() => {
            if (!selectedElder || !campus || !date || !time) return;
            router.push({
              pathname: '/confirmation',
              params: { campus, date, time, elder: selectedElder.name },
            });
          }}
        >
          <Text style={styles.continueButtonText}>Confirm Appointment</Text>
        </Pressable>
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
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: '#c0392b', textAlign: 'center', fontSize: 14 },
  retryButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  elderList: { gap: 12 },
  elderButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  elderButtonSelected: { backgroundColor: COASTAL_BLUE },
  elderButtonText: { color: COASTAL_BLUE, fontSize: 16, fontWeight: '600' },
  elderButtonTextSelected: { color: '#fff' },
  confirmation: {
    marginTop: 24,
    backgroundColor: '#EAF1F6',
    borderLeftWidth: 4,
    borderLeftColor: COASTAL_BLUE,
    borderRadius: 6,
    padding: 12,
  },
  confirmationText: { color: COASTAL_BLUE, fontWeight: '600' },
  continueButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonDisabled: { backgroundColor: '#B8CBD8' },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});