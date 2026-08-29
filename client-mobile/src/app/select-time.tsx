import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchTimes } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

// Backend now provides plain YYYY-MM-DD strings. Parsing with `new
// Date(iso)` directly treats them as UTC midnight, which can display as
// the PREVIOUS day in negative-UTC-offset timezones — appending a local
// midnight time avoids that shift.
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function toApiDate(iso: string): string {
  return iso.split('T')[0]; // YYYY-MM-DD, what the backend expects
}

export default function SelectTimeScreen() {
  const { campus, date, elder } = useLocalSearchParams<{ campus: string; date: string; elder: string }>();
  const router = useRouter();
  const [times, setTimes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  useEffect(() => {
    loadTimes();
  }, [campus, date]);

  async function loadTimes() {
    if (!campus || !date) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchTimes(campus, toApiDate(date), elder);
      setTimes(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: formatDate(date) }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>
          {campus} — {formatDate(date)}
        </Text>
        <Text style={styles.title}>What time works for you?</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Couldn't load times. Check your connection and try again.
            </Text>
            <Pressable style={styles.retryButton} onPress={loadTimes}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && times.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              No times are available on this date. Try a different date.
            </Text>
          </View>
        )}

        {!loading && !error && times.length > 0 && (
          <View style={styles.timeList}>
            {times.map((time) => {
              const isSelected = time === selectedTime;
              return (
                <Pressable
                  key={time}
                  onPress={() => setSelectedTime(time)}
                  style={[styles.timeButton, isSelected && styles.timeButtonSelected]}
                >
                  <Text
                    style={[styles.timeButtonText, isSelected && styles.timeButtonTextSelected]}
                  >
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedTime && (
          <View style={styles.confirmation}>
            <Text style={styles.confirmationText}>Selected: {selectedTime}</Text>
          </View>
        )}

        <Pressable
          disabled={!selectedTime}
          style={[styles.continueButton, !selectedTime && styles.continueButtonDisabled]}
          onPress={() => {
            if (!selectedTime || !campus || !date || !elder) return;
            router.push({
              pathname: '/confirmation',
              params: { campus, date, time: selectedTime, elder },
            });
          }}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
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
  timeList: { gap: 12 },
  timeButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  timeButtonSelected: { backgroundColor: COASTAL_BLUE },
  timeButtonText: { color: COASTAL_BLUE, fontSize: 15, fontWeight: '600' },
  timeButtonTextSelected: { color: '#fff' },
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
