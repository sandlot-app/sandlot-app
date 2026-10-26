import { Stack } from 'expo-router/stack';
import { Redirect, useGlobalSearchParams } from 'expo-router';
import { OfflineGameProvider } from '../../scoring/use-offline-game.tsx';

export default function GameLayout() {
  const { gallery } = useGlobalSearchParams<{ gallery?: string }>();
  if (__DEV__ && typeof gallery === 'string')
    return <Redirect href={{ pathname: '/gallery', params: { gallery } }} />;
  return (
    <OfflineGameProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OfflineGameProvider>
  );
}
