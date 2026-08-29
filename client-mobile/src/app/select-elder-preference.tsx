import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchCampusElders, type Elder } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function SelectElderPreferenceScreen() {
  const { campus, classDate } = useLocalSearchParams<{ campus: string; classDate: string }>();
  const router = useRouter();
  const [elders, setElders] = useState<Elder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadElders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campus]);

  async function loadElders() {
    if (!campus) return;
    setLoading(true);
    setError(false);
    try {
      setElders(await fetchCampusElders(campus));
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function pickElder(elder: Elder) {
    router.push({ pathname: '/availability-window', params: { campus, classDate, elder: elder.name } });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'choose your elder' }} />
      <View style={styles.container}>
        <Text style={styles.subtitle}>{campus}</Text>
        <Text style={styles.title}>choose your preferred elder</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>couldn't load elders. check your connection and try again.</Text>
            <Pressable style={styles.retryButton} onPress={loadElders}>
              <Text style={styles.retryButtonText}>retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && elders.length === 0 && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>no elders found for this campus.</Text>
          </View>
        )}

        {!loading && !error && elders.length > 0 && (
          <View style={styles.elderList}>
            {elders.map((elder) => (
              <Pressable key={elder.id} style={styles.elderButton} onPress={() => pickElder(elder)}>
                <Text style={styles.elderButtonText}>{elder.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!loading && (
          <Pressable
            style={styles.engagementLink}
            onPress={() => router.push({ pathname: '/engagement', params: { campus } })}
          >
            <Text style={styles.engagementLinkText}>none of these work for me</Text>
          </Pressable>
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
    fontSize: 18,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 24,
  },
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: '#c0392b', textAlign: 'center', fontSize: 13 },
  retryButton: { backgroundColor: COASTAL_BLUE, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  elderList: { gap: 12 },
  elderButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  elderButtonText: { color: COASTAL_BLUE, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  engagementLink: { marginTop: 24, alignItems: 'center', paddingVertical: 8 },
  engagementLinkText: { color: '#6b7c88', fontSize: 13, textDecorationLine: 'underline' },
});
