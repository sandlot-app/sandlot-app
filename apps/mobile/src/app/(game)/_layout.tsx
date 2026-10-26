import { Stack } from 'expo-router/stack';
import { OfflineGameProvider } from '../../scoring/use-offline-game.tsx';

export default function GameLayout() {
  return (
    <OfflineGameProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OfflineGameProvider>
  );
}
