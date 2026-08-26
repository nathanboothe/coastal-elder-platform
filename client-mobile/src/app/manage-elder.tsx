import { useLocalSearchParams, useRouter } from 'expo-router';
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

import {
  createElderAvailability,
  createElderTimeOff,
  deleteElderAvailability,
  deleteElderTimeOff,
  fetchElderAvailability,
  fetchElderTimeOff,
  getAdminElderName,
  type AvailabilityRow,
  type TimeOffRow,
} from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const WEEK_CHOICES = ['1st', '2nd', '3rd', '4th', '5th', 'Every Week'];
const SLOT_ORDER = [
  '7:30 AM', '8:00 AM', '8:30 AM', '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM',
  '2:30 PM', '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM', '9:00 PM',
  '9:30 PM', '10:00 PM',
];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ManageElderScreen() {
  const { elderName: paramElderName } = useLocalSearchParams<{ elderName?: string }>();
  const router = useRouter();
  const elderName = paramElderName || getAdminElderName();

  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newDay, setNewDay] = useState<string | null>(null);
  const [newWeeks, setNewWeeks] = useState<string[]>([]);
  const [newSlots, setNewSlots] = useState<string[]>([]);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [savingTimeOff, setSavingTimeOff] = useState(false);
  const [timeOffError, setTimeOffError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elderName]);

  async function loadAll() {
    if (!elderName) {
      setError('No elder record found for your account. Contact an administrator.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [availData, timeOffData] = await Promise.all([
        fetchElderAvailability(elderName),
        fetchElderTimeOff(elderName),
      ]);
      setAvailability(availData);
      setTimeOff(timeOffData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddAvailability() {
    if (!elderName) return;
    if (!newDay || newWeeks.length === 0 || newSlots.length === 0) {
      setAvailError('Pick a day, at least one week, and at least one time slot.');
      return;
    }
    setSavingAvailability(true);
    setAvailError(null);
    try {
      await createElderAvailability({
        elderName,
        dayOfWeek: newDay,
        weekOfMonth: newWeeks,
        timeSlots: newSlots,
      });
      setNewDay(null);
      setNewWeeks([]);
      setNewSlots([]);
      await loadAll();
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingAvailability(false);
    }
  }

  async function handleDeleteAvailability(id: string) {
    try {
      await deleteElderAvailability(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  async function handleAddTimeOff() {
    if (!elderName) return;
    if (!startDate.trim() || !endDate.trim()) {
      setTimeOffError('Start date and end date are required.');
      return;
    }
    setSavingTimeOff(true);
    setTimeOffError(null);
    try {
      await createElderTimeOff({
        elderName,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        notes: notes.trim() || undefined,
      });
      setStartDate('');
      setEndDate('');
      setNotes('');
      await loadAll();
    } catch (err) {
      setTimeOffError(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSavingTimeOff(false);
    }
  }

  async function handleDeleteTimeOff(id: string) {
    try {
      await deleteElderTimeOff(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete.');
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={COASTAL_BLUE} />
        </View>
      </SafeAreaView>
    );
  }

  if (error && !elderName) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{elderName}</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Text style={styles.sectionTitle}>Availability</Text>

        {availability.map((row) => (
          <View key={row.id} style={styles.rowCard}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowMain}>{row['Day of Week']}</Text>
              <Text style={styles.rowMeta}>{(row['Week of Month'] || []).join(', ')}</Text>
              <Text style={styles.rowMeta}>{(row['Time Slots'] || []).join(', ')}</Text>
            </View>
            <Pressable
              style={styles.deleteButton}
              onPress={() => handleDeleteAvailability(row.id)}
            >
              <Text style={styles.deleteButtonText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.form}>
          <Text style={styles.formLabel}>Day</Text>
          <View style={styles.chipRow}>
            {DAY_NAMES.map((day) => (
              <Pressable
                key={day}
                onPress={() => setNewDay(day)}
                style={[styles.chip, newDay === day && styles.chipSelected]}
              >
                <Text style={[styles.chipText, newDay === day && styles.chipTextSelected]}>
                  {day}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.formLabel}>Week(s) of Month</Text>
          <View style={styles.chipRow}>
            {WEEK_CHOICES.map((week) => {
              const isSelected = newWeeks.includes(week);
              return (
                <Pressable
                  key={week}
                  onPress={() => setNewWeeks(toggle(newWeeks, week))}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {week}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.formLabel}>Time Slot(s)</Text>
          <View style={styles.chipRow}>
            {SLOT_ORDER.map((slot) => {
              const isSelected = newSlots.includes(slot);
              return (
                <Pressable
                  key={slot}
                  onPress={() => setNewSlots(toggle(newSlots, slot))}
                  style={[styles.chip, isSelected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                    {slot}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {availError && <Text style={styles.errorText}>{availError}</Text>}

          <Pressable
            style={[styles.addButton, savingAvailability && styles.addButtonDisabled]}
            onPress={handleAddAvailability}
            disabled={savingAvailability}
          >
            {savingAvailability ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Add Availability</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>Time Off</Text>

        {timeOff.map((row) => (
          <View key={row.id} style={styles.rowCard}>
            <View style={styles.rowInfo}>
              <Text style={styles.rowMain}>
                {row['Start Date']} — {row['End Date']}
              </Text>
              {!!row.Notes && <Text style={styles.rowMeta}>{row.Notes}</Text>}
            </View>
            <Pressable style={styles.deleteButton} onPress={() => handleDeleteTimeOff(row.id)}>
              <Text style={styles.deleteButtonText}>Remove</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.form}>
          <Text style={styles.formLabel}>Start Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-08-15"
          />
          <Text style={styles.formLabel}>End Date (YYYY-MM-DD)</Text>
          <TextInput
            style={styles.input}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-08-22"
          />
          <Text style={styles.formLabel}>Notes (optional)</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Vacation, conference, etc."
          />

          {timeOffError && <Text style={styles.errorText}>{timeOffError}</Text>}

          <Pressable
            style={[styles.addButton, savingTimeOff && styles.addButtonDisabled]}
            onPress={handleAddTimeOff}
            disabled={savingTimeOff}
          >
            {savingTimeOff ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Add Time Off</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COASTAL_BLUE, marginBottom: 10 },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  rowCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAF1F6',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  rowInfo: { flex: 1 },
  rowMain: { fontSize: 14, fontWeight: '700', color: COASTAL_BLUE },
  rowMeta: { fontSize: 12, color: '#6b7c88', marginTop: 2 },
  deleteButton: {
    borderWidth: 1,
    borderColor: '#c0392b',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  deleteButtonText: { color: '#c0392b', fontSize: 12, fontWeight: '600' },
  form: { gap: 6, marginTop: 12, marginBottom: 8 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COASTAL_BLUE, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: COASTAL_BLUE },
  chipText: { color: COASTAL_BLUE, fontSize: 12, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  addButton: {
    backgroundColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  addButtonDisabled: { opacity: 0.6 },
  addButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#EAF1F6', marginVertical: 20 },
});
