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
        <Stack.Screen name="code" options={{ headerShown: true, title: 'Enter Code' }} />
        <Stack.Screen
          name="confirm-campus"
          options={{ headerShown: true, title: 'Confirm Campus' }}
        />
        <Stack.Screen name="admin" options={{ headerShown: true, title: 'Elder / Admin' }} />
        <Stack.Screen name="redirect" options={{ headerShown: false }} />
        <Stack.Screen name="admin-home" options={{ headerShown: true, title: 'Admin' }} />
        <Stack.Screen name="manage-wac-codes" options={{ headerShown: true, title: 'WAC Codes' }} />
        <Stack.Screen
          name="manage-elder-picker"
          options={{ headerShown: true, title: 'Select Elder' }}
        />
        <Stack.Screen name="manage-elder" options={{ headerShown: true, title: 'Manage' }} />
        <Stack.Screen
          name="select-elder-preference"
          options={{ headerShown: true, title: 'Choose Your Elder' }}
        />
        <Stack.Screen name="availability-window" options={{ headerShown: true }} />
        <Stack.Screen name="engagement" options={{ headerShown: true, title: 'Contact Engagement' }} />
        <Stack.Screen name="confirmation" options={{ headerShown: true }} />
        <Stack.Screen name="confirmed" options={{ headerShown: true }} />
      </Stack>
    </ThemeProvider>
  );
}
