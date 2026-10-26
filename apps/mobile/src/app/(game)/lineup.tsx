import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, ScrollView, Text, View } from 'react-native';
import { applyGroup } from '@sandlot/engine';
import type { LineupSlot, Position, Timestamp } from '@sandlot/engine';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens } from '@sandlot/tokens';
import { PrimaryButton } from '../../../scorer-ui';
import { createStyles } from '../../../style';
import { BookHeader, BookSection, bookStyles } from '../../components/book-ui.tsx';
import { BookIcon } from '../../components/book-icons.tsx';
import { assignPosition, initialLineup, roster, setupFor } from '../../scoring/game-setup.ts';
import { displayPlayer, teamNames } from '../../scoring/roster-presentation.ts';
import { useOfflineGame } from '../../scoring/use-offline-game.tsx';

const {colors, sizes, textStyles} = tokens.modes.Light;
const positionChoices: (Position | null)[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', null];
type Picker = {kind: 'position'; id: string} | {kind: 'roster' | 'pitcher'} | null;
const dragTransform = (translateY: number) => ({transform: [{translateY}]});

function LineupRow({slot, index, first, onPosition, onMove, onDragging}: {slot: LineupSlot; index: number; first: boolean; onPosition(): void; onMove(id: string, offset: number): void; onDragging(dragging: boolean): void}) {
  const [offset, setOffset] = useState(0);
  const [height, setHeight] = useState(51);
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => onDragging(true),
    onPanResponderMove: (_, gesture) => setOffset(gesture.dy),
    onPanResponderRelease: (_, gesture) => {setOffset(0); onDragging(false); onMove(slot.player.id, Math.round(gesture.dy / height));},
    onPanResponderTerminate: () => {setOffset(0); onDragging(false);},
  }), [height, onDragging, onMove, slot.player.id]);
  const player = displayPlayer(slot.player);
  return <View onLayout={(event) => setHeight(event.nativeEvent.layout.height)} style={[styles.lineupRow, !first && bookStyles.rule, offset !== 0 && styles.dragging, dragTransform(offset)]} testID={`lineup-row-${slot.player.id}`}>
    <Text style={styles.order} testID={`lineup-order-${slot.player.id}`}>{index + 1}</Text>
    <View style={styles.number}><Text style={bookStyles.strong}>{player.number}</Text></View>
    <Text style={[bookStyles.strong, styles.name]}>{player.name}</Text>
    <Pressable onPress={onPosition} accessibilityRole="button" accessibilityLabel={`${player.name}, ${slot.position ?? 'Bats only'}. Change position`} testID={`lineup-position-${slot.player.id}`} style={styles.positionTap}>
      <Text style={styles.position}>{slot.position ?? 'Bats only'}</Text>
    </Pressable>
    <View {...responder.panHandlers} testID={`lineup-drag-${slot.player.id}`} style={styles.dragHandle} accessible accessibilityRole="adjustable" accessibilityLabel={`Move ${player.name} in the batting order`}
      accessibilityActions={[{name: 'increment', label: 'Move down'}, {name: 'decrement', label: 'Move up'}]} onAccessibilityAction={(event) => onMove(slot.player.id, event.nativeEvent.actionName === 'increment' ? 1 : -1)}>
      <BookIcon name="menu" size={16} />
    </View>
  </View>;
}

export default function LineupScreen() {
  const {side: requestedSide} = useLocalSearchParams<{side?: string}>();
  const side = requestedSide === 'home' ? 'home' : 'away';
  const {view, setupDraft, setSetupDraft} = useOfflineGame();
  const [lineup, setLineup] = useState(() => (setupDraft.lineups[side] ?? initialLineup(side)).map((slot) => ({...slot})));
  const [picker, setPicker] = useState<Picker>(null);
  const [dragging, setDragging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const pitcher = lineup.find((slot) => slot.position === 'P')?.player;
  const available = view.kind === 'ready';
  const remaining = roster[side].filter((player) => !lineup.some((slot) => slot.player.id === player.id));
  const move = useCallback((id: string, offset: number) => setLineup((current) => {
    const from = current.findIndex((slot) => slot.player.id === id);
    const to = Math.max(0, Math.min(current.length - 1, from + offset));
    if (from < 0 || from === to) return current;
    const next = [...current]; next.splice(to, 0, next.splice(from, 1)[0]!); return next;
  }), []);
  if ((view.kind === 'ready' || view.kind === 'saving') && view.game) return <Redirect href="/score" />;
  const choosePosition = (position: Position | null) => {
    if (picker?.kind !== 'position') return;
    setLineup((current) => assignPosition(current, picker.id, position)); setPicker(null);
  };
  const save = () => {
    if (!available) return;
    const home = side === 'home' ? lineup : setupDraft.lineups.home ?? initialLineup('home');
    const away = side === 'away' ? lineup : setupDraft.lineups.away ?? initialLineup('away');
    const accepted = applyGroup(setupFor(setupDraft.seasonHalf), [], [
      {kind: 'game', control: {kind: 'lineup_set', side: 'home', lineup: home}},
      {kind: 'game', control: {kind: 'lineup_set', side: 'away', lineup: away}},
      {kind: 'game', control: {kind: 'start', umpireStart: new Date().toISOString() as Timestamp}},
    ]);
    if (!accepted.ok) {setMessage(accepted.code === 'no_pitcher' ? 'Choose a starting pitcher before saving the lineup.' : accepted.code === 'unknown_player' ? 'A selected player is not on this game’s roster.' : 'This lineup cannot be saved. Check the selected players.'); return;}
    setSetupDraft({...setupDraft, lineups: {...setupDraft.lineups, [side]: lineup}}); router.back();
  };
  return <SafeAreaView style={bookStyles.screen} testID="lineup-screen">
    <BookHeader title={`${teamNames[side]} lineup`} onBack={() => router.back()} testID="cancel-lineup" />
    <ScrollView contentContainerStyle={bookStyles.content} scrollEnabled={!dragging}>
      <Text style={bookStyles.caption}>Everyone here bats, in this order. Drag to reorder, and tap a position to change it.</Text>
      <BookSection label="Batting order">
        <View style={bookStyles.card}>
          {lineup.map((slot, index) => <View key={slot.player.id}>
            <LineupRow slot={slot} index={index} first={index === 0} onPosition={() => setPicker(picker?.kind === 'position' && picker.id === slot.player.id ? null : {kind: 'position', id: slot.player.id})} onMove={move} onDragging={setDragging} />
            {picker?.kind === 'position' && picker.id === slot.player.id ? <View style={styles.positionChoices}>
              {positionChoices.map((position) => <Pressable key={position ?? 'bats-only'} testID={`position-${position ?? 'bats-only'}`} accessibilityRole="button" accessibilityState={{selected: slot.position === position}} onPress={() => choosePosition(position)} style={[styles.choice, slot.position === position && styles.selectedChoice]}>
                <Text style={[bookStyles.caption, slot.position === position && styles.selectedChoiceText]}>{position ?? 'Bats only'}</Text>
              </Pressable>)}
            </View> : null}
          </View>)}
        </View>
        {remaining.length ? <Pressable testID="lineup-add-player" accessibilityRole="button" onPress={() => setPicker(picker?.kind === 'roster' ? null : {kind: 'roster'})} style={bookStyles.linkTap}><Text style={bookStyles.link}>Add a player from the roster</Text></Pressable> : null}
        {picker?.kind === 'roster' ? <View style={bookStyles.card}>{remaining.map((player, index) => <Pressable key={player.id} accessibilityRole="button" testID={`add-player-${player.id}`} style={[styles.rosterRow, index > 0 && bookStyles.rule]} onPress={() => {setLineup((current) => [...current, {player, position: null}]); setPicker(null);}}>
          <Text style={bookStyles.strong}>#{displayPlayer(player).number} · {displayPlayer(player).name}</Text><Text style={bookStyles.caption}>Add</Text>
        </Pressable>)}</View> : null}
      </BookSection>
      <BookSection label="Starting pitcher">
        {pitcher ? <View style={styles.pitcherCard}>
          <View style={styles.pitcherNumber}><Text style={bookStyles.strong}>{displayPlayer(pitcher).number}</Text></View>
          <View style={styles.pitcherDescription}><Text style={bookStyles.strong} testID="lineup-starting-pitcher">{displayPlayer(pitcher).name}</Text><Text style={styles.mutedCaption}>Fully rested · 75 pitches available today</Text></View>
          <View style={styles.check}><BookIcon name="check" size={14} color={colors['text/on-accent']} /></View>
        </View> : <Text style={bookStyles.caption}>No starting pitcher selected.</Text>}
        <Pressable testID="change-starting-pitcher" accessibilityRole="button" onPress={() => setPicker(picker?.kind === 'pitcher' ? null : {kind: 'pitcher'})} style={bookStyles.linkTap}><Text style={bookStyles.link}>Change starting pitcher</Text></Pressable>
        {picker?.kind === 'pitcher' ? <View style={bookStyles.card}>{lineup.map((slot, index) => <Pressable key={slot.player.id} accessibilityRole="button" testID={`choose-pitcher-${slot.player.id}`} style={[styles.rosterRow, index > 0 && bookStyles.rule]} onPress={() => {setLineup((current) => assignPosition(current, slot.player.id, 'P')); setPicker(null);}}>
          <Text style={bookStyles.strong}>#{displayPlayer(slot.player).number} · {displayPlayer(slot.player).name}</Text><Text style={bookStyles.caption}>{slot.position === 'P' ? 'Pitching' : 'Choose'}</Text>
        </Pressable>)}</View> : null}
      </BookSection>
      {message ? <Text style={bookStyles.error} accessibilityLiveRegion="polite" testID="lineup-message">{message}</Text> : null}
      <PrimaryButton label="Save lineup" testID="save-lineup" disabled={!available} onPress={save} />
    </ScrollView>
  </SafeAreaView>;
}

const styles = createStyles({
  lineupRow: {minHeight: 51, flexDirection: 'row', alignItems: 'center', gap: sizes['space/2'], backgroundColor: colors['surface/card']},
  dragging: {zIndex: 5, backgroundColor: colors['surface/page'], opacity: 0.95},
  order: {...textStyles.Caption, width: 22, textAlign: 'center', color: colors['text/tertiary']},
  number: {width: 34, height: 34, borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'], alignItems: 'center', justifyContent: 'center'},
  name: {flex: 1},
  positionTap: {minHeight: sizes['tap/min'], justifyContent: 'center'},
  position: {...textStyles.Caption, color: colors['text/secondary'], backgroundColor: colors['surface/page'], borderRadius: sizes['radius/full'], paddingHorizontal: sizes['space/3'], paddingVertical: sizes['space/1']},
  dragHandle: {width: 24, minHeight: sizes['tap/min'], alignItems: 'center', justifyContent: 'center', touchAction: 'none'},
  positionChoices: {flexDirection: 'row', flexWrap: 'wrap', gap: sizes['space/2'], paddingBottom: sizes['space/2']},
  choice: {minHeight: sizes['tap/min'], minWidth: 44, paddingHorizontal: sizes['space/2'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/md'], justifyContent: 'center', alignItems: 'center'},
  selectedChoice: {backgroundColor: colors['scoreboard/bg'], borderColor: colors['scoreboard/bg']},
  selectedChoiceText: {color: colors['text/on-accent']},
  rosterRow: {minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: sizes['space/3']},
  pitcherCard: {minHeight: 64, borderWidth: 2, borderColor: colors['scoreboard/bg'], borderRadius: sizes['radius/lg'], flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingHorizontal: sizes['space/3']},
  pitcherNumber: {width: 32, height: 32, borderWidth: 1.5, borderColor: colors['scoreboard/bg'], backgroundColor: colors['surface/card'], borderRadius: sizes['radius/full'], alignItems: 'center', justifyContent: 'center'},
  pitcherDescription: {flex: 1},
  mutedCaption: {...textStyles.Caption, color: colors['text/tertiary']},
  check: {width: 22, height: 22, borderRadius: sizes['radius/full'], backgroundColor: colors['scoreboard/bg'], alignItems: 'center', justifyContent: 'center'},
});
