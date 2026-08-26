import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const COASTAL_BLUE = '#407DA8';

export default function LandingScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Coastal Church</Text>
        <Text style={styles.subtitle}>Schedule a Membership Meeting</Text>

        <View style={styles.form}>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/code')}>
            <Text style={styles.primaryButtonText}>Book an Appointment</Text>
          </Pressable>

          <Pressable style={styles.secondaryButton} onPress={() => router.push('/admin')}>
            <Text style={styles.secondaryButtonText}>I'm an Elder or Admin</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7c88',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 40,
  },
  form: { gap: 12 },
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
