import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COASTAL_BLUE = '#407DA8';

export default function ConfirmCampusScreen() {
  const { campus, classDate } = useLocalSearchParams<{ campus: string; classDate: string }>();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.messageBox}>
          <Text style={styles.messageText}>
            The code entered indicates you attended "We Are Coastal" at the {campus} campus. Tap
            "Next" to continue or tap "Choose a different campus" to create an appointment at an
            alternate campus.
          </Text>
        </View>

        <View style={styles.buttons}>
          <Pressable
            style={styles.primaryButton}
            onPress={() => router.push({ pathname: '/select-date', params: { campus, classDate } })}
          >
            <Text style={styles.primaryButtonText}>Next</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => router.push({ pathname: '/book', params: { classDate } })}
          >
            <Text style={styles.secondaryButtonText}>Choose a different campus</Text>
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
