import { Stack } from 'expo-router/stack';
import { Redirect, useGlobalSearchParams } from 'expo-router';
import { SetupDraftProvider } from '../../scoring/setup-draft.tsx';
import { OfflineGameProvider } from '../../scoring/use-offline-game.tsx';

export default function GameLayout() {
  const { gallery } = useGlobalSearchParams<{ gallery?: string }>();
  if (__DEV__ && typeof gallery === 'string')
    return <Redirect href={{ pathname: '/gallery', params: { gallery } }} />;
  return (
    <OfflineGameProvider>
      <SetupDraftProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </SetupDraftProvider>
    </OfflineGameProvider>
  );
}
