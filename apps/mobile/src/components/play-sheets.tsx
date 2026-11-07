import type { Destination, GameState, OutType, Position } from '@sandlot/engine';
import { tokens } from '@sandlot/tokens';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { PlayerChip, PrimaryButton, Sheet, SheetHeader, SheetSection } from '../../scorer-ui';
import { createStyles } from '../../style';
import { UserIcon } from './icons.tsx';
import { playerDisplay } from '../scoring/demo-roster.ts';
import { basesSummary } from '../scoring/game-summary.ts';
import type { DemoAction } from '../scoring/offline-game.ts';
import {
  chooseDestination, completePlay, draftProblem, earlierOut, outcomeChoices, runnerRows,
} from '../scoring/tap-play.ts';
import type { InPlayDraft, PlayDraft, RunnerChoice, RunnerMode } from '../scoring/tap-play.ts';

const {colors, sizes, textStyles} = tokens.modes.Light;
const destinations: {to: Destination; label: string}[] = [
  {to: 1, label: '1st'}, {to: 2, label: '2nd'}, {to: 3, label: '3rd'},
  {to: 'home', label: 'Home'}, {to: 'out', label: 'Out'},
];
const runnerModes: {mode: RunnerMode; title: string; subtitle: string; path: string}[] = [
  {mode: 'steal', title: 'Steal attempt', subtitle: 'Safe or caught stealing', path: 'M11 5a2 2 0 1 0 4 0 2 2 0 1 0-4 0M8 10l-3 2c-3 2-1 6 2 5l11-5c4-2 6 2 3 5l-3 2M11 23a2 2 0 1 0 4 0 2 2 0 1 0-4 0'},
  {mode: 'wild_pitch', title: 'Wild pitch', subtitle: 'Runners advance on the pitch', path: 'M3 8h5c5 0 5 12 10 12h5m-4-4 4 4-4 4M3 20h5c5 0 5-12 10-12h5m-4-4 4 4-4 4'},
  {mode: 'passed_ball', title: 'Passed ball', subtitle: 'Runners advance, catcher charged', path: 'm16 6 7 7-7 7M23 13H12c-6 0-9 3-9 8'},
  {mode: 'pickoff', title: 'Pickoff', subtitle: 'Throw to a base', path: 'm10 3-7 7 7 7M3 10h12c5 0 7 3 7 8'},
];
const fieldPositions = ['LF', 'CF', 'RF', 'SS', '2B', '3B', '1B', 'P', 'C'] as const satisfies readonly Position[];
const positionNames: Record<Position, string> = {
  P: 'pitcher', C: 'catcher', '1B': 'first base', '2B': 'second base', '3B': 'third base',
  SS: 'shortstop', LF: 'left field', CF: 'center field', RF: 'right field', ROVER: 'rover',
};

function Fielders({draft, onChange}: {draft: InPlayDraft; onChange: (draft: PlayDraft) => void}) {
  const side = draft.game.state.half === 'top' ? 'home' : 'away';
  const batting = side === 'home' ? 'away' : 'home';
  return <View style={styles.field}>
    <Svg width="100%" height="100%" viewBox="0 0 310 335" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}>
      <Rect width={310} height={335} fill={colors['field/grass']} />
      {[0, 62, 124, 186, 248].map((x) => <Rect key={x} x={x} width={31} height={335} fill={colors['field/grass-stripe']} />)}
      <Path d="M-35 90Q155-70 345 90" fill="none" stroke={colors['field/dirt']} strokeWidth={9} />
      <Circle cx={155} cy={190} r={91} fill={colors['field/dirt']} />
      <Path d="m155 121 69 69-69 69-69-69Z" fill={colors['field/grass']} />
      <Path d="m0 100 155 155 155-155M86 190l69-69 69 69-69 69Z" fill="none" stroke={colors['field/line']} strokeWidth={1.5} />
      <Path d="m155 114 5 5-5 5-5-5Z m-76 76 5 5-5 5-5-5Z m152 0 5 5-5 5-5-5Z M150 250h10v5l-5 5-5-5Z" fill={colors['field/base']} />
    </Svg>
    {fieldPositions.map((position) => {
      const index = draft.game.state.lineups[side].findIndex((slot) => slot.position === position);
      if (index < 0) return null;
      return <View key={position} style={[styles.fielder, fieldStyles[position]]}>
        {draft.fielder === position ? <View style={styles.selectedFielder} pointerEvents="none" /> : null}
        <PlayerChip {...playerDisplay(draft.game.state, side, draft.game.state.lineups[side][index]!.player)} role="fielding" testID={`fielder-${position}`}
          onPress={() => onChange({...draft, fielder: position})} />
      </View>;
    })}
    {runnerRows(draft.game, draft.choice).map((row) => <View key={row.runner.id} style={[styles.contextPlayer, baseStyles[row.from]]} pointerEvents="none">
      <PlayerChip {...playerDisplay(draft.game.state, batting, row.runner)} role={row.from === 0 ? 'batter' : 'batting'} />
    </View>)}
  </View>;
}

function RunnerRow({state, row, rows, inPlay, choice, first, onRows}: {
  state: GameState; row: RunnerChoice; rows: RunnerChoice[]; inPlay: boolean;
  choice: InPlayDraft['choice']; first: boolean; onRows: (rows: RunnerChoice[]) => void;
}) {
  const shown = playerDisplay(state, state.half === 'top' ? 'away' : 'home', row.runner);
  const outs = rows.filter((other) => other.to === 'out').sort((a, b) => a.outOrder - b.outOrder);
  const outNumber = outs.findIndex((other) => other.runner.id === row.runner.id) + 1;
  const caught = row.from === 0 && (choice?.trajectory === 'fly' || choice?.trajectory === 'line' || choice?.trajectory === 'popup');
  const classifications: {value: OutType; label: string}[] = row.from === 0 && choice?.section === 'Hit'
    ? [{value: 'non_force', label: `Tag after reaching ${choice.bases === 2 ? 'second' : choice.bases === 3 ? 'third' : choice.bases === 4 ? 'home' : 'first'}`}] : row.from === 0
    ? [{value: 'batter_before_first', label: caught ? 'Caught before reaching first' : 'Out before first'},
      ...caught ? [] : [{value: 'non_force' as const, label: 'Tag after reaching first'}]]
    : [...row.forced && choice?.section !== 'Hit' ? [{value: 'force' as const, label: 'Out before required base'}] : [],
      {value: 'non_force', label: row.forced ? 'Tag after reaching required base' : 'Tag out (not forced)'}];
  const updateType = (outType: OutType) => onRows(rows.map((other) => other.runner.id === row.runner.id ? {...other, outType} : other));
  return <View style={[styles.runnerRow, !first && styles.runnerDivider]} testID={`runner-${row.runner.id}`}>
    <View style={styles.runnerHeading}>
      <PlayerChip number={shown.number} name={shown.name} role="batting" layout="inline" testID={`runner-chip-${row.runner.id}`} />
      <Text style={styles.caption}>{row.from === 0 ? 'batter' : `from ${destinations.find((item) => item.to === row.from)!.label}`}{row.to === 'home' ? ' · scores' : ''}</Text>
    </View>
    <View style={styles.destinationRow}>
      {destinations.map(({to, label}) => <Pressable key={to} accessibilityRole="button"
        accessibilityLabel={`${shown.name} to ${label}`}
        accessibilityState={{selected: row.to === to}}
        onPress={() => onRows(chooseDestination(rows, row.runner.id, to))}
        testID={`destination-${row.runner.id}-${to}`}
        style={[styles.destination, row.to === to && (to === 'out' ? styles.selectedOut : styles.selected)]}>
        <Text style={[styles.strong, row.to === to && styles.selectedText]}>{label}</Text>
      </Pressable>)}
    </View>
    {inPlay && row.to === 'out' ? <View style={styles.outDetails}>
      {classifications.map(({value, label}) => <Pressable key={value} accessibilityRole="button"
        accessibilityState={{selected: row.outType === value}} onPress={() => updateType(value)}
        testID={`out-type-${row.runner.id}-${value}`} style={[styles.detailChoice, row.outType === value && styles.detailSelected]}>
        <Text style={styles.caption}>{row.outType === value ? '● ' : '○ '}{label}</Text>
      </Pressable>)}
      {outs.length > 1 ? <Pressable accessibilityRole="button" disabled={outNumber === 1}
        onPress={() => onRows(earlierOut(rows, row.runner.id))} testID={`out-order-${row.runner.id}`} style={styles.orderButton}>
        <Text style={styles.link}>Out {outNumber}{outNumber > 1 ? ' · Move earlier' : ' · First out of this play'}</Text>
      </Pressable> : null}
    </View> : null}
  </View>;
}

function batterName(state: GameState): string {
  const side = state.half === 'top' ? 'away' : 'home';
  const batter = state.lineups[side][state.nextBatter[side]]?.player;
  return batter ? playerDisplay(state, side, batter).name : 'Batter';
}

export function PlaySheets({draft, onChange, onClose, record, saving, available, message}: {
  draft: PlayDraft | null; onChange: (draft: PlayDraft) => void; onClose: () => void;
  record: (action: DemoAction) => Promise<boolean>; saving: boolean; available: boolean; message: string | null;
}) {
  const [attempted, setAttempted] = useState(false);
  if (!draft) return null;
  const close = () => { if (!saving) { setAttempted(false); onClose(); } };
  const hitByPitch = async () => {
    setAttempted(true);
    if (await record({kind: 'pitch', result: 'hit_by_pitch'})) { setAttempted(false); onClose(); }
  };
  if (draft.kind === 'more') return <Sheet open onRequestClose={close} testID="play-more"
    header={<SheetHeader title="More" onCancel={close} cancelLabel="Done" />}>
    <SheetSection label="Runners">
      <View style={styles.moreCard}>
      {runnerModes.map(({mode, title, subtitle, path}, index) => <Pressable key={mode} accessibilityRole="button" testID={`more-${mode}`}
        onPress={() => { setAttempted(false); onChange({kind: 'runner', at: new Date().toISOString(), mode, game: draft.game, rows: runnerRows(draft.game, null)}); }} style={[styles.moreRow, index > 0 && styles.moreDivider]}>
        <View style={styles.moreIcon}>
          <Svg width={24} height={28} viewBox="0 0 26 28" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}><Path d={path} fill="none" stroke={colors['text/primary']} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" /></Svg>
        </View>
        <View style={styles.moreDescription}><Text style={styles.strong}>{title}</Text><Text style={styles.caption}>{subtitle}</Text></View>
        <Svg width={16} height={16} viewBox="0 0 24 24" accessible={Platform.OS === 'web' ? undefined : false} aria-hidden={Platform.OS === 'web' ? true : undefined}><Path d="m9 6 6 6-6 6" fill="none" stroke={colors['text/tertiary']} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></Svg>
      </Pressable>)}
      </View>
    </SheetSection>
    <SheetSection label="Pitch">
      <View style={styles.moreCard}>
        <Pressable accessibilityRole="button" testID="more-hit_by_pitch" disabled={saving || !available}
          accessibilityState={{disabled: saving || !available}} onPress={() => {void hitByPitch();}} style={styles.moreRow}>
          <View style={styles.moreIcon}>
            <UserIcon color={colors['text/primary']} />
          </View>
          <View style={styles.moreDescription}><Text style={styles.strong}>Hit by pitch</Text><Text style={styles.caption}>Batter takes first base</Text></View>
        </Pressable>
      </View>
    </SheetSection>
    {attempted && message ? <Text style={styles.error} accessibilityLiveRegion="polite" testID="play-message">{message}</Text> : null}
  </Sheet>;
  const inPlay = draft.kind === 'in_play';
  const step = inPlay ? draft.step === 'outcome' ? 1 : draft.step === 'fielder' ? 2 : 3 : undefined;
  const title = inPlay ? step === 1 ? 'What happened?' : step === 2 ? 'Who fielded it?' : 'Where did runners end up?'
    : runnerModes.find(({mode}) => mode === draft.mode)!.title;
  const onBack = inPlay ? step === 1 ? undefined : () => onChange({...draft, step: step === 3 ? 'fielder' : 'outcome'}) : () => onChange({kind: 'more', game: draft.game});
  const toRunners = (fielder: Position | null) => {
    if (inPlay && draft.choice) onChange({...draft, fielder, step: 'runners', rows: draft.rows.length ? draft.rows : runnerRows(draft.game, draft.choice)});
  };
  const fielderSide = draft.game.state.half === 'top' ? 'home' : 'away';
  const fielder = inPlay && draft.fielder ? draft.game.state.lineups[fielderSide].find((slot) => slot.position === draft.fielder)?.player : undefined;
  const fielderName = fielder ? playerDisplay(draft.game.state, fielderSide, fielder).name : null;
  const action = completePlay(draft);
  const problem = draftProblem(draft);
  const save = async () => {
    if (!action || !available) return;
    setAttempted(true);
    if (await record(action)) { setAttempted(false); onClose(); }
  };
  const actions = inPlay && step === 1 ? undefined : inPlay && step === 2 ? <>
    <PrimaryButton label={draft.fielder ? `Next · ${fielderName}, ${positionNames[draft.fielder]}` : 'Next'} onPress={() => toRunners(draft.fielder)} disabled={!draft.fielder} testID="play-next" />
    <Pressable accessibilityRole="button" onPress={() => toRunners(null)} style={styles.skip} testID="skip-fielder"><Text style={styles.link}>Skip</Text></Pressable>
  </> : <PrimaryButton label={saving ? 'Saving…' : available ? 'Save play' : 'Scoring paused'} onPress={() => {void save();}} disabled={!action || !available} testID="save-play" />;
  return <View style={styles.modal} accessibilityViewIsModal>
    <Sheet open onRequestClose={close} testID={inPlay ? step === 1 ? 'play-outcomes' : step === 2 ? 'play-fielders' : 'play-runners' : 'play-runner-action'}
      header={<SheetHeader title={title} step={step} steps={inPlay ? 3 : undefined} onBack={saving ? undefined : onBack} onCancel={close} />} actions={actions}>
      {inPlay && step === 1 ? <>
        <Text style={styles.caption}>{batterName(draft.game.state)} · {draft.game.state.count.balls}–{draft.game.state.count.strikes} count · {basesSummary(draft.game.state.bases)}</Text>
        {(['Hit', 'Out', 'Other'] as const).map((section) => <SheetSection key={section} label={section}>
          <View style={styles.outcomeGrid}>{outcomeChoices.filter((choice) => choice.section === section).map((choice) => <Pressable key={choice.id}
            accessibilityRole="button" testID={`outcome-${choice.id}`} onPress={() => onChange({...draft, step: 'fielder', choice, rows: []})}
            style={[styles.outcome, draft.choice?.id === choice.id && styles.selected]}>
            <Text style={[styles.strong, draft.choice?.id === choice.id && styles.selectedText]}>{choice.label}</Text>
          </Pressable>)}</View>
        </SheetSection>)}
      </> : inPlay && step === 2 ? <>
        <Text style={styles.fielderCaption}>{draft.choice!.label} · tap the player who fielded it</Text>
        <Fielders draft={draft} onChange={onChange} />
      </> : <>
        <Text style={styles.caption}>{inPlay ? `${draft.choice!.label}${draft.fielder ? ` to ${draft.fielder === 'CF' ? 'center' : draft.fielder === 'LF' ? 'left' : draft.fielder === 'RF' ? 'right' : positionNames[draft.fielder]}` : ''} · pre-filled, change anything that’s wrong`
          : draft.mode === 'steal' ? 'Who ran, and where did they end up? Pick Out for caught stealing.'
          : draft.mode === 'pickoff' ? 'Who was picked off? Pick Out for that runner.'
          : 'Who advanced, and where did they end up? Leave other runners on their current base.'}</Text>
        {!draft.rows.length ? <Text style={styles.caption}>No runners on base.</Text> : null}
        <View>{draft.rows.map((row, index) => <RunnerRow key={row.runner.id} state={draft.game.state} row={row} rows={draft.rows} inPlay={inPlay} first={index === 0}
          choice={inPlay ? draft.choice : null} onRows={(rows) => onChange({...draft, rows})} />)}</View>
        {draft.rows.some((row) => row.to === 'home') && draft.game.state.outs + draft.rows.filter((row) => row.to === 'out').length >= 3
          ? <Text style={styles.caption} testID="third-out-evidence">{inPlay
            ? 'Home means the runner crossed before the third out. Check the out type and the order of outs; a force or batter out before first as the third out cancels the run.'
            : 'Home means the runner crossed before the third out. The advances and crossings are saved before the selected outs.'}</Text> : null}
        {problem ? <Text style={styles.error} testID="play-validation" accessibilityLiveRegion="polite">{problem}</Text> : null}
        {attempted && message ? <Text style={styles.error} accessibilityLiveRegion="polite" testID="play-message">{message}</Text> : null}
      </>}
    </Sheet>
  </View>;
}

const styles = createStyles({
  modal: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20},
  caption: {...textStyles.Caption, color: colors['text/secondary']},
  fielderCaption: {...textStyles.Caption, color: colors['text/secondary'], textAlign: 'center'},
  strong: {...textStyles['Body/Strong'], color: colors['text/primary']},
  link: {...textStyles['Body/Strong'], color: colors['text/link']},
  outcomeGrid: {flexDirection: 'row', flexWrap: 'wrap', gap: sizes['space/2']},
  outcome: {width: '48%', flexGrow: 1, minHeight: 48, borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/lg'], alignItems: 'center', justifyContent: 'center', paddingHorizontal: sizes['space/2']},
  selected: {backgroundColor: colors['scoreboard/bg'], borderColor: colors['scoreboard/bg']},
  selectedOut: {backgroundColor: colors['count/strike'], borderColor: colors['count/strike']},
  selectedText: {color: colors['text/on-accent']},
  field: {height: 335, width: '86%', alignSelf: 'center', borderRadius: sizes['radius/lg'], overflow: 'hidden', backgroundColor: colors['field/grass']},
  fielder: {position: 'absolute', width: 74},
  contextPlayer: {position: 'absolute', width: 74},
  selectedFielder: {position: 'absolute', top: -5, left: 15, width: 44, height: 44, borderWidth: 3, borderColor: colors['chip/outline'], borderRadius: sizes['radius/full']},
  skip: {minHeight: sizes['tap/min'], alignItems: 'center', justifyContent: 'center'},
  runnerRow: {paddingVertical: sizes['space/4'], gap: sizes['space/2']},
  runnerDivider: {borderTopWidth: 1, borderTopColor: colors['border/subtle']},
  runnerHeading: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: sizes['space/2']},
  destinationRow: {flexDirection: 'row', gap: sizes['space/1']},
  destination: {flex: 1, minWidth: 0, minHeight: sizes['tap/min'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/md'], alignItems: 'center', justifyContent: 'center'},
  outDetails: {gap: sizes['space/2']},
  detailChoice: {minHeight: sizes['tap/min'], justifyContent: 'center', paddingHorizontal: sizes['space/2'], borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/md']},
  detailSelected: {borderColor: colors['scoreboard/bg'], backgroundColor: colors['surface/page']},
  orderButton: {minHeight: sizes['tap/min'], justifyContent: 'center'},
  moreCard: {borderWidth: 1, borderColor: colors['border/subtle'], borderRadius: sizes['radius/lg'], overflow: 'hidden'},
  moreRow: {minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingHorizontal: sizes['space/3']},
  moreDivider: {borderTopWidth: 1, borderTopColor: colors['border/subtle']},
  moreIcon: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors['surface/page'], borderRadius: sizes['radius/md']},
  moreDescription: {flex: 1, gap: sizes['space/1']},
  error: {...textStyles.Caption, color: colors['text/warning']},
});
const fieldStyles = createStyles({
  LF: {left: '6%', top: 60}, CF: {left: '38%', top: 22}, RF: {right: '6%', top: 60},
  SS: {left: '24%', top: 115}, '2B': {right: '20%', top: 115}, '3B': {left: '3%', top: 155},
  '1B': {right: '3%', top: 155}, P: {left: '38%', top: 195}, C: {left: '38%', top: 280},
});

const baseStyles = createStyles({
  0: {left: '20%', top: 235}, 1: {right: '12%', top: 180},
  2: {left: '38%', top: 90}, 3: {left: '12%', top: 180},
});
