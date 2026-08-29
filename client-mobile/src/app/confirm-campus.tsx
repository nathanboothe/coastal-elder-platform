import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            The code you entered indicates that you attended We Are Coastal on {formatDate(classDate)} at{' '}
            {campus}. Do you have a preferred elder you would like to meet with?
          </Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={styles.primaryButton}
            onPress={() =>
              router.push({ pathname: '/select-elder-preference', params: { campus, classDate, preferred: '1' } })
            }
          >
            <Text style={styles.primaryButtonText}>Yes</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() =>
              router.push({ pathname: '/select-elder-preference', params: { campus, classDate, preferred: '0' } })
            }
          >
            <Text style={styles.secondaryButtonText}>No preference</Text>
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
