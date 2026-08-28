import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createWacCode, deactivateWacCode, fetchWacCodes, type WacCode } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

// Matches the fixed choice list on the WACCodes table's Campus field in
// Airtable. No admin-scoped campus-list endpoint exists yet, so this is
// hardcoded rather than fetched — see chat for the tradeoff note.
const CAMPUSES = [
  'Battery Park',
  'Bethany Campus',
  'Chesapeake',
  'Gloucester',
  'Hampton',
  'Mathews',
  'Williamsburg',
  'Yorktown',
];

export default function AdminHomeScreen() {
  const [codes, setCodes] = useState<WacCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newCode, setNewCode] = useState('');
  const [newCampus, setNewCampus] = useState<string | null>(null);
  const [newClassDate, setNewClassDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  async function loadCodes() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWacCodes();
      setCodes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load codes.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newCode.trim() || !newCampus || !newClassDate.trim()) {
      setCreateError('Code, campus, and class date are all required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await createWacCode({
        code: newCode.trim(),
        campusName: newCampus,
        classDate: newClassDate.trim(),
      });
      setNewCode('');
      setNewCampus(null);
      setNewClassDate('');
      await loadCodes();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create code.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeactivate(id: string) {
    try {
      await deactivateWacCode(id);
      await loadCodes();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate code.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>We Are Coastal Codes</Text>

        <View style={styles.form}>
          <Text style={styles.formLabel}>New code</Text>
          <TextInput
            style={styles.input}
            value={newCode}
            onChangeText={setNewCode}
            placeholder="e.g. AUG2026"
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={styles.formLabel}>Campus</Text>
          <View style={styles.campusGrid}>
            {CAMPUSES.map((c) => {
              const isSelected = c === newCampus;
              return (
                <Pressable
                  key={c}
                  onPress={() => setNewCampus(c)}
                  style={[styles.campusChip, isSelected && styles.campusChipSelected]}
                >
                  <Text
                    style={[styles.campusChipText, isSelected && styles.campusChipTextSelected]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.formLabel}>Class date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={newClassDate}
            onChangeText={setNewClassDate}
            placeholder="2026-08-09"
            keyboardType="numbers-and-punctuation"
          />

          {createError && <Text style={styles.errorText}>{createError}</Text>}

          <Pressable
            style={[styles.createButton, creating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createButtonText}>Create Code</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Existing Codes</Text>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COASTAL_BLUE} />
          </View>
        )}

        {!loading && error && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={loadCodes}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        )}

        {!loading && !error && codes.length === 0 && (
          <Text style={styles.emptyText}>No codes yet.</Text>
        )}

        {!loading &&
          !error &&
          codes
            .filter((c) => c.active)
            .map((c) => (
              <View key={c.id} style={styles.codeRow}>
                <View style={styles.codeInfo}>
                  <Text style={styles.codeText}>{c.code}</Text>
                  <Text style={styles.codeMeta}>
                    {c.campus} · {c.classDate}
                  </Text>
                </View>
                <Pressable style={styles.deactivateButton} onPress={() => handleDeactivate(c.id)}>
                  <Text style={styles.deactivateButtonText}>Deactivate</Text>
                </Pressable>
              </View>
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
  form: { gap: 8, marginBottom: 20 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COASTAL_BLUE, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  campusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  campusChip: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  campusChipSelected: { backgroundColor: COASTAL_BLUE },
  campusChipText: { color: COASTAL_BLUE, fontSize: 13, fontWeight: '600' },
  campusChipTextSelected: { color: '#fff' },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center' },
  createButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  createButtonDisabled: { opacity: 0.6 },
  createButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#EAF1F6', marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COASTAL_BLUE, marginBottom: 12 },
  centerBox: { alignItems: 'center', paddingVertical: 24, gap: 12 },
  retryButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  emptyText: { color: '#6b7c88', textAlign: 'center', paddingVertical: 20 },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAF1F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  codeRowInactive: { opacity: 0.5 },
  codeInfo: { flex: 1 },
  codeText: { fontSize: 15, fontWeight: '700', color: COASTAL_BLUE, letterSpacing: 1 },
  codeMeta: { fontSize: 12, color: '#6b7c88', marginTop: 2 },
  deactivateButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deactivateButtonText: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
});
