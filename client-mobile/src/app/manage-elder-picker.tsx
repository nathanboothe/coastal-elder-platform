import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchAllElders, refreshFromM365, type AdminElder, type M365SyncSummary } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function ManageElderPickerScreen() {
  const router = useRouter();
  const [elders, setElders] = useState<AdminElder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncSummary, setSyncSummary] = useState<M365SyncSummary | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    loadElders();
  }, []);

  async function loadElders() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAllElders();
      setElders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load elders.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    try {
      const summary = await refreshFromM365();
      setSyncSummary(summary);
      await loadElders();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Failed to refresh from M365.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Select an Elder</Text>

        <View style={styles.syncBox}>
          <Text style={styles.syncIntro}>
            Syncs elders from Coastal's three elder groups in M365. Elders added manually aren't
            affected.
          </Text>
          <Pressable style={styles.syncButton} onPress={handleSync} disabled={syncing}>
            {syncing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>Refresh from M365</Text>
            )}
          </Pressable>

          {syncError && <Text style={styles.errorText}>{syncError}</Text>}

          {syncSummary && (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryLine}>
                ✅ Added: {syncSummary.added.length ? syncSummary.added.join(', ') : 'none'}
              </Text>
              <Text style={styles.summaryLine}>
                🔄 Updated: {syncSummary.updated.length ? syncSummary.updated.join(', ') : 'none'}
              </Text>
              <Text style={styles.summaryLine}>
                ↩️ Reactivated:{' '}
                {syncSummary.reactivated.length ? syncSummary.reactivated.join(', ') : 'none'}
              </Text>
              <Text style={styles.summaryLine}>
                🚫 Marked inactive:{' '}
                {syncSummary.deactivated.length ? syncSummary.deactivated.join(', ') : 'none'}
              </Text>
              {syncSummary.skipped.length > 0 && (
                <Text style={styles.summaryLine}>
                  ⚠️ Skipped: {syncSummary.skipped.map((s) => `${s.name} (${s.reason})`).join('; ')}
                </Text>
              )}
              {syncSummary.cancelledAppointments.length > 0 && (
                <Text style={styles.summaryLine}>
                  📧 {syncSummary.cancelledAppointments.length} future appointment(s) were cancelled
                  and reported to the OME email.
                </Text>
              )}
              {syncSummary.duplicates.length > 0 && (
                <Text style={styles.summaryLine}>
                  ⚠️ {syncSummary.duplicates.length} elder(s) found in more than one elder group —
                  reported to the OME email for cleanup in M365.
                </Text>
              )}
            </View>
          )}
        </View>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadElders}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading &&
          !error &&
          [...elders]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((elder) => (
            <Pressable
              key={elder.id}
              style={styles.elderRow}
              onPress={() =>
                router.push({ pathname: '/manage-elder', params: { elderName: elder.name } })
              }
            >
              <Text style={styles.elderName}>{elder.name}</Text>
              <Text style={styles.elderCampus}>{elder.campus}</Text>
            </Pressable>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 20,
  },
  syncBox: {
    backgroundColor: '#EAF1F6',
    borderLeftWidth: 4,
    borderLeftColor: COASTAL_BLUE,
    borderRadius: 6,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  syncIntro: { color: COASTAL_BLUE, fontSize: 13, lineHeight: 18 },
  syncButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  summaryBox: { gap: 4, marginTop: 4 },
  summaryLine: { fontSize: 12, color: COASTAL_BLUE },
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: '#c0392b', textAlign: 'center', fontSize: 13 },
  retryButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  elderRow: {
    borderWidth: 1,
    borderColor: '#EAF1F6',
    borderRadius: 8,
    padding: 14,
    marginBottom: 8,
  },
  elderName: { fontSize: 15, fontWeight: '700', color: COASTAL_BLUE },
  elderCampus: { fontSize: 12, color: '#6b7c88', marginTop: 2 },
});
