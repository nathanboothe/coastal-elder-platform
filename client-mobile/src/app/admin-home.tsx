import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getAdminRole } from '@/lib/api';

const COASTAL_BLUE = '#407DA8';

export default function AdminHomeScreen() {
  const router = useRouter();
  const role = getAdminRole();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Admin</Text>

        <View style={styles.menu}>
          <Pressable style={styles.menuButton} onPress={() => router.push('/manage-wac-codes')}>
            <Text style={styles.menuButtonText}>We Are Coastal Codes</Text>
          </Pressable>

          {role === 'elder' && (
            <Pressable style={styles.menuButton} onPress={() => router.push('/manage-elder')}>
              <Text style={styles.menuButtonText}>My Availability & Time Off</Text>
            </Pressable>
          )}

          {role === 'admin' && (
            <Pressable
              style={styles.menuButton}
              onPress={() => router.push('/manage-elder-picker')}
            >
              <Text style={styles.menuButtonText}>Elder Availability & Time Off</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 24, paddingTop: 32 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COASTAL_BLUE,
    textAlign: 'center',
    marginBottom: 32,
  },
  menu: { gap: 12 },
  menuButton: {
    borderWidth: 1.5,
    borderColor: COASTAL_BLUE,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  menuButtonText: { color: COASTAL_BLUE, fontSize: 16, fontWeight: '600' },
});
