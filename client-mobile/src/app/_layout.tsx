import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: true, title: 'Elder / Admin' }} />
        <Stack.Screen name="redirect" options={{ headerShown: false }} />
        <Stack.Screen name="admin-home" options={{ headerShown: true, title: 'Admin' }} />
        <Stack.Screen name="manage-wac-codes" options={{ headerShown: true, title: 'WAC Codes' }} />
        <Stack.Screen
          name="manage-elder-picker"
          options={{ headerShown: true, title: 'Select Elder' }}
        />
        <Stack.Screen name="manage-elder" options={{ headerShown: true, title: 'Manage' }} />
      </Stack>
    </ThemeProvider>
  );
}