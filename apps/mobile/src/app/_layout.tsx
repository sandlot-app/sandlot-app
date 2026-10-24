import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { OfflineGameProvider } from '../scoring/use-offline-game.tsx';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OfflineGameProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </OfflineGameProvider>
    </SafeAreaProvider>
  );
}
