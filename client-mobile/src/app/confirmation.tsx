import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createAppointment } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

// Backend now provides plain YYYY-MM-DD strings. Parsing with `new
// Date(iso)` directly treats them as UTC midnight, which can display as
// the PREVIOUS day in negative-UTC-offset timezones — appending a local
// midnight time avoids that shift.
function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function toApiDate(iso: string): string {
  return iso.split('T')[0]; // YYYY-MM-DD, what the backend expects
}

export default function ConfirmationScreen() {
  const { campus, date, time, elder } = useLocalSearchParams<{
    campus: string;
    date: string;
    time: string;
    elder: string;
  }>();
  const router = useRouter();

  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!campus || !date || !time || !elder) return;
    if (!memberName.trim() || !memberEmail.trim()) {
      setError('Please enter your name and email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await createAppointment({
        campusName: campus,
        elderName: elder,
        date: toApiDate(date),
        timeSlot: time,
        memberName: memberName.trim(),
        memberEmail: memberEmail.trim(),
        memberPhone: memberPhone.trim() || undefined,
      });
      // Only navigate to the success screen once the backend has actually
      // confirmed the slot — if it was taken in the meantime, the error
      // surfaces here instead of a false "You're All Set!" screen.
      router.replace({
        pathname: '/confirmed',
        params: { campus, date, time, elder, emailSent: String(result.emailSent) },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to book your appointment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ title: 'Review & Confirm' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Review your appointment</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Campus</Text>
            <Text style={styles.value}>{campus}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(date)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>{time}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.label}>Elder</Text>
            <Text style={styles.value}>{elder}</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Text style={styles.formLabel}>Your name</Text>
          <TextInput
            style={styles.input}
            value={memberName}
            onChangeText={(text) => {
              setMemberName(text);
              setError(null);
            }}
            placeholder="Full name"
            autoCapitalize="words"
          />

          <Text style={styles.formLabel}>Your email</Text>
          <TextInput
            style={styles.input}
            value={memberEmail}
            onChangeText={(text) => {
              setMemberEmail(text);
              setError(null);
            }}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <Text style={styles.formLabel}>Your phone number</Text>
          <TextInput
            style={styles.input}
            value={memberPhone}
            onChangeText={(text) => setMemberPhone(text)}
            placeholder="(757) 555-0100"
            keyboardType="phone-pad"
          />
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          style={[styles.confirmButton, submitting && styles.confirmButtonDisabled]}
          onPress={handleConfirm}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.confirmButtonText}>Confirm appointment</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 20,
  },
  card: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
  divider: { height: 1, backgroundColor: '#EAF1F6' },
  label: { color: '#6b7c88', fontSize: 14, fontWeight: '600' },
  value: { color: COASTAL_BLUE, fontSize: 15, fontWeight: '700' },
  form: { gap: 8, marginBottom: 12 },
  formLabel: { fontSize: 13, fontWeight: '600', color: COASTAL_BLUE, marginTop: 8 },
  input: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  errorText: { color: '#c0392b', fontSize: 13, textAlign: 'center', marginBottom: 8 },
  confirmButton: {
    marginTop: 'auto',
    marginBottom: 24,
    backgroundColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.7 },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
