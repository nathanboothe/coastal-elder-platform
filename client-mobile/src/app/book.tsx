import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchCampuses, type Campus } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function BookScreen() {
  const { classDate } = useLocalSearchParams<{ classDate?: string }>();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState<Campus | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadCampuses();
  }, []);

  async function loadCampuses() {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchCampuses();
      setCampuses(data);
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Select Your Campus</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>
              Couldn't load campuses. Check your connection and try again.
            </Text>
            <Pressable style={styles.retryButton} onPress={loadCampuses}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && (
          <>
            <View style={styles.grid}>
              {campuses.map((campus) => {
                const isSelected = campus.id === selectedCampus?.id;
                return (
                  <Pressable
                    key={campus.id}
                    onPress={() => setSelectedCampus(campus)}
                    style={[styles.campusButton, isSelected && styles.campusButtonSelected]}
                  >
                    <Text
                      style={[
                        styles.campusButtonText,
                        isSelected && styles.campusButtonTextSelected,
                      ]}
                    >
                      {campus.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedCampus && (
              <View style={styles.confirmation}>
                <Text style={styles.confirmationText}>Selected: {selectedCampus.name}</Text>
              </View>
            )}
          </>
        )}

        <Pressable
          disabled={!selectedCampus}
          style={[styles.continueButton, !selectedCampus && styles.continueButtonDisabled]}
          onPress={() => {
            if (!selectedCampus) return;
            router.push({
              pathname: '/select-date',
              params: { campus: selectedCampus.name, classDate },
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
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  title: {
    fontSize: 22,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  campusButton: {
    width: '48%',
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  campusButtonSelected: { backgroundColor: COASTAL_BLUE },
  campusButtonText: {
    color: COASTAL_BLUE,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  campusButtonTextSelected: { color: '#fff' },
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
