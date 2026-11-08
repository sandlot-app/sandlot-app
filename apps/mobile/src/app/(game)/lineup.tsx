import { tokens } from '@sandlot/tokens';
import type { LineupSlot, PlayerRef, TeamSide } from '@sandlot/engine';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createStyles } from '../../../style';
import { PrimaryButton } from '../../../scorer-ui';
import { BattingOrder } from '../../components/batting-order.tsx';
import { BenchPlayerRow } from '../../components/bench-player-row.tsx';
import { AddPlayerSheet, PitcherSheet, PositionSheet } from '../../components/lineup-sheets.tsx';
import { RejectionBand, SectionLabel, SetupNav } from '../../components/setup-chrome.tsx';
import { rosterDisplay } from '../../scoring/demo-roster.ts';
import {
  addChoices, addFromRoster, movePlayer, pitcherChoices, positionChoices, removeFromLineup, saveLineup, setPosition, setStartingPitcher,
  setupRejection, teamName,
} from '../../scoring/game-setup.ts';
import { gameSetup } from '../../scoring/demo-game.ts';
import { useSetupDraft } from '../../scoring/setup-draft.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

type Open = { kind: 'position'; index: number } | { kind: 'pitcher' } | { kind: 'add' } | null;

/** Figma Scorer — Lineup · Hawks (168:11244): a team's batting order, its starting pitcher, and adding from the roster. */
export default function LineupScreen() {
  const { side: param } = useLocalSearchParams<{ side?: string }>();
  const side: TeamSide = param === 'home' ? 'home' : 'away';
  const { draft, setDraft } = useSetupDraft();
  const [slots, setSlots] = useState<LineupSlot[]>(draft.lineups[side].slots);
  const [open, setOpen] = useState<Open>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const team = teamName(side);
  const choices = pitcherChoices(draft.half, slots);
  const pitching = choices.find((choice) => choice.selected);

  const edit = (next: LineupSlot[]) => { setMessage(null); setSlots(next); };
  const moveBatter = useCallback((from: number, to: number) => { setMessage(null); setSlots((current) => movePlayer(current, from, to)); }, []);
  const save = () => {
    const result = saveLineup(draft, side, slots);
    if (result.kind === 'saved') { setDraft(result.draft); router.back(); }
    else setMessage(setupRejection(result.code));
  };
  const chosen = (player: PlayerRef) => { edit(setStartingPitcher(slots, player)); setOpen(null); };

  return (
    <SafeAreaView style={styles.screen}>
      <SetupNav title={`${team} lineup`} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.content} scrollEnabled={!dragging} testID="lineup-content">
        <Text style={styles.hint}>Everyone here bats, in this order. Drag to reorder, and tap a position to change it.</Text>
        <View style={styles.section}>
          <SectionLabel>Batting order</SectionLabel>
          <BattingOrder slots={slots} onMove={moveBatter}
            onPickPosition={(index) => setOpen({ kind: 'position', index })} onDragging={setDragging} />
          <Pressable accessibilityRole="button" hitSlop={sizes['space/3']} onPress={() => setOpen({ kind: 'add' })} style={styles.linkTap} testID="add-player">
            <Text style={styles.link}>Add a player from the roster</Text>
          </Pressable>
        </View>
        <View style={styles.section}>
          <SectionLabel>Starting pitcher</SectionLabel>
          {pitching
            ? <BenchPlayerRow number={pitching.number} name={pitching.name} note={pitching.note} selected testID="starting-pitcher" />
            : <Text style={styles.none} testID="starting-pitcher-none">No starting pitcher yet.</Text>}
          <Pressable accessibilityRole="button" hitSlop={sizes['space/3']} onPress={() => setOpen({ kind: 'pitcher' })} style={styles.linkTap} testID="change-pitcher">
            <Text style={styles.link}>{pitching ? 'Change starting pitcher' : 'Choose a starting pitcher'}</Text>
          </Pressable>
        </View>
        <View style={styles.actions}>
          {message ? <RejectionBand message={message} testID="lineup-message" /> : null}
          <PrimaryButton label="Save lineup" onPress={save} testID="save-lineup" />
        </View>
      </ScrollView>
      {open?.kind === 'position'
        ? <PositionSheet name={rosterDisplay(slots[open.index]!.player).name} choices={positionChoices(slots, open.index, gameSetup(draft.half).rules.fielders)} onClose={() => setOpen(null)}
          onChoose={(choice) => { edit(setPosition(slots, open.index, choice.position)); setOpen(null); }}
          onRemove={() => { edit(removeFromLineup(slots, open.index)); setOpen(null); }} />
        : open?.kind === 'pitcher'
          ? <PitcherSheet choices={choices} onChoose={chosen} onClose={() => setOpen(null)} />
          : open?.kind === 'add'
            ? <AddPlayerSheet team={team} choices={addChoices(side, slots)} onClose={() => setOpen(null)}
              onChoose={(player) => { edit(addFromRoster(slots, player)); setOpen(null); }} />
            : null}
    </SafeAreaView>
  );
}

const styles = createStyles({
  screen: { flex: 1, backgroundColor: colors['surface/page'] },
  content: { gap: sizes['space/4'], paddingTop: sizes['space/1'], paddingHorizontal: sizes['space/4'], paddingBottom: sizes['space/6'] },
  hint: { ...textStyles.Caption, color: colors['text/secondary'] },
  section: { gap: sizes['space/2'] },
  linkTap: { alignItems: 'center', justifyContent: 'center' },
  link: { ...textStyles['Body/Strong'], color: colors['text/link'], textAlign: 'center' },
  none: { ...textStyles['Body/Regular'], color: colors['text/secondary'] },
  actions: { gap: sizes['space/3'], paddingTop: sizes['space/2'] },
});
