import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchAvailabilityWindow, type AvailabilityWindowDay } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default function AvailabilityWindowScreen() {
  const { campus, classDate, elder } = useLocalSearchParams<{
    campus: string;
    classDate: string;
    elder: string;
  }>();
  const router = useRouter();
  const [days, setDays] = useState<AvailabilityWindowDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus, elder]);

  async function load() {
    if (!campus || !classDate || !elder) return;
    setLoading(true);
    setError(false);
    try {
      setDays(await fetchAvailabilityWindow(campus, classDate, elder));
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function pickSlot(date: string, time: string) {
    router.push({ pathname: '/confirmation', params: { campus, date, time, elder } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: elder ?? 'Availability' }} />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.subtitle}>{campus}</Text>
        <Text style={styles.title}>{elder}'s availability over the next two weeks</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>Couldn't load availability. Check your connection and try again.</Text>
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && days.length === 0 && (
          <Text style={styles.errorText}>No open times for this elder in the next two weeks.</Text>
        )}

        {!loading &&
          !error &&
          days.map((day) => (
            <View key={day.date} style={styles.dayGroup}>
              <Text style={styles.dayLabel}>{formatDate(day.date)}</Text>
              <View style={styles.timeGrid}>
                {day.times.map((t) => (
                  <Pressable key={t} style={styles.timeButton} onPress={() => pickSlot(day.date, t)}>
                    <Text style={styles.timeButtonText}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

        {!loading && (
          <View style={styles.fallbackButtons}>
            <Pressable
              style={styles.fallbackButton}
              onPress={() => router.push({ pathname: '/select-elder-preference', params: { campus, classDate } })}
            >
              <Text style={styles.fallbackButtonText}>None of these work — choose a different elder</Text>
            </Pressable>
            <Pressable
              style={styles.fallbackButton}
              onPress={() => router.push({ pathname: '/engagement', params: { campus } })}
            >
              <Text style={styles.fallbackButtonText}>None of these work for me</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },
  subtitle: { textAlign: 'center', color: '#6b7c88', fontSize: 14, marginBottom: 4 },
  title: { fontSize: 17, fontWeight: '700', color: COASTAL_BLUE, textAlign: 'center', marginBottom: 24 },
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: '#c0392b', textAlign: 'center', fontSize: 13, marginBottom: 12 },
  retryButton: { backgroundColor: COASTAL_BLUE, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  dayGroup: { marginBottom: 20 },
  dayLabel: { fontSize: 14, fontWeight: '700', color: '#333', marginBottom: 8 },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  timeButtonText: { color: COASTAL_BLUE, fontSize: 14, fontWeight: '600' },
  fallbackButtons: { gap: 10, marginTop: 12 },
  fallbackButton: { alignItems: 'center', paddingVertical: 10 },
  fallbackButtonText: { color: '#6b7c88', fontSize: 13, textDecorationLine: 'underline' },
});
