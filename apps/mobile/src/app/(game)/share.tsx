import { tokens } from '@sandlot/tokens';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStyles } from '../../../style';
import { childSideOf, demoChild, demoDivision, playerDisplay, teamsOf } from '../../scoring/demo-roster.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';
import { gameShare } from '../../share/game-share.ts';
import { sampleShares } from '../../share/sample-share.ts';
import { ShareScreen } from '../../share/share-screen.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** The sticker picker for the demo family's child, from a Final game. `?game=sample` (and the worst cases) are dev-only previews. */
export default function ShareRoute() {
  const { game } = useLocalSearchParams<{ game?: string }>();
  const { games } = useOfflineGame();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const sample = game && Object.hasOwn(sampleShares, game) ? sampleShares[game] : undefined;
  // Keyed by game, so opening the picker for another game starts fresh: name off, Poster picked.
  if (sample) return __DEV__ ? <ShareScreen key={game} share={sample} onClose={close} /> : <Redirect href="/" />;
  const saved = game === 'synced' ? games.synced : games.local;
  const childSide = saved ? childSideOf(saved.state.lineups) : 'away';
  const share = saved && saved.state.status === 'final' ? gameShare({
    setup: saved.setup, events: saved.events, state: saved.state, player: demoChild.player, side: childSide,
    names: { first: demoChild.first, last: demoChild.last, number: playerDisplay(saved.state, childSide, demoChild.player).number },
    team: teamsOf(saved.state.lineups)[childSide].name, division: demoDivision,
  }) : null;
  if (share) return <ShareScreen key={game} share={share} onClose={close} />;
  return <SafeAreaView style={styles.screen}>
    <Text style={styles.message} testID="share-unavailable">
      {saved?.state.status === 'final' ? `${demoChild.first} didn’t bat in this game, so there’s nothing to share.` : 'Stickers are ready once the game is final.'}
    </Text>
    <Pressable accessibilityRole="button" onPress={close} style={styles.back}><Text style={styles.backText}>Back to Your games</Text></Pressable>
  </SafeAreaView>;
}

const styles = createStyles({
  screen: { flex: 1, backgroundColor: colors['surface/page'], padding: sizes['space/6'], gap: sizes['space/4'] },
  message: { ...textStyles['Body/Regular'], color: colors['text/secondary'] },
  back: { minHeight: sizes['tap/min'], justifyContent: 'center' },
  backText: { ...textStyles['Body/Strong'], color: colors['action/primary'] },
});
