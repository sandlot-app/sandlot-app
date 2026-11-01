import { tokens } from '@sandlot/tokens';
import type { PlayerRef } from '@sandlot/engine';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { PrimaryButton, Sheet, SheetHeader, SheetSection } from '../../scorer-ui';
import type { PlayerChoice, PositionChoice } from '../scoring/game-setup.ts';
import { BenchPlayerRow } from './bench-player-row.tsx';
import { CheckIcon } from './icons.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** The list a position pill opens. It has no Figma frame; it is laid out like the More sheet's cards. */
export function PositionSheet({ name, choices, onChoose, onClose }: {
  name: string;
  choices: PositionChoice[];
  onChoose: (choice: PositionChoice) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onRequestClose={onClose} testID="position-sheet" header={<SheetHeader title={`${name}’s position`} onCancel={onClose} />}>
      <SheetSection>
        <View style={styles.card}>
          {choices.map((choice, index) => (
            <Pressable key={choice.label} accessibilityRole="radio" accessibilityState={{ selected: choice.selected }}
              accessibilityLabel={`${choice.label}. ${choice.note}`} onPress={() => onChoose(choice)}
              style={[styles.positionRow, index > 0 && styles.divided]} testID={`position-choice-${choice.label}`}>
              <View style={styles.positionText}>
                <Text style={styles.strong}>{choice.label}</Text>
                <Text style={styles.caption}>{choice.note}</Text>
              </View>
              {choice.selected ? <CheckIcon color={colors['scoreboard/bg']} size={20} /> : null}
            </Pressable>
          ))}
        </View>
      </SheetSection>
    </Sheet>
  );
}

/** The sheet "Change starting pitcher" opens, laid out like Figma's Pitching change sheet (87:3137). */
export function PitcherSheet({ choices, onChoose, onClose }: {
  choices: (PlayerChoice & { selected: boolean })[];
  onChoose: (player: PlayerRef) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<PlayerRef | null>(choices.find((choice) => choice.selected)?.player ?? null);
  return (
    <Sheet open onRequestClose={onClose} testID="pitcher-sheet" header={<SheetHeader title="Starting pitcher" onCancel={onClose} />}
      actions={<PrimaryButton label={'Pitch first'} disabled={!picked}
        onPress={() => picked && onChoose(picked)} testID="pitcher-confirm" />}>
      <SheetSection label="Pitches first">
        <View style={styles.rows}>
          {choices.map((choice) => (
            <BenchPlayerRow key={choice.player.id} number={choice.number} name={choice.name} note={choice.note}
              selected={picked?.id === choice.player.id} onPress={() => setPicked(choice.player)} testID={`pitcher-choice-${choice.player.id}`} />
          ))}
        </View>
      </SheetSection>
    </Sheet>
  );
}

/** The sheet "Add a player from the roster" opens: roster players not in the lineup. Tapping one adds them. */
export function AddPlayerSheet({ team, choices, onChoose, onClose }: {
  team: string;
  choices: PlayerChoice[];
  onChoose: (player: PlayerRef) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open onRequestClose={onClose} testID="add-sheet" header={<SheetHeader title="Add a player" onCancel={onClose} />}>
      <SheetSection label={`${team} roster`}>
        {choices.length === 0
          ? <Text style={styles.caption} testID="add-empty">Everyone on the roster is already in the lineup.</Text>
          : <View style={styles.rows}>
            {choices.map((choice) => (
              <BenchPlayerRow key={choice.player.id} number={choice.number} name={choice.name} note={choice.note}
                onPress={() => onChoose(choice.player)} testID={`add-choice-${choice.player.id}`} />
            ))}
          </View>}
      </SheetSection>
    </Sheet>
  );
}

const styles = createStyles({
  card: { borderRadius: sizes['radius/lg'], backgroundColor: colors['surface/page'], paddingHorizontal: sizes['space/4'], paddingVertical: sizes['space/1'] },
  positionRow: { minHeight: sizes['tap/min'], flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingVertical: sizes['space/2'] },
  divided: { borderTopWidth: 1, borderTopColor: colors['border/subtle'] },
  positionText: { flex: 1 },
  strong: { ...textStyles['Body/Strong'], color: colors['text/primary'] },
  caption: { ...textStyles.Caption, color: colors['text/secondary'] },
  rows: { gap: sizes['space/2'] },
});
