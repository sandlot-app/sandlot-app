import { tokens } from '@sandlot/tokens';
import type { LineupSlot } from '@sandlot/engine';
import { useMemo, useState } from 'react';
import { PanResponder, Pressable, Text, View } from 'react-native';
import { createStyles } from '../../style';
import { rosterDisplay } from '../scoring/demo-roster.ts';
import { positionLabel } from '../scoring/game-setup.ts';
import { DragHandleIcon } from './setup-marks.tsx';

const { colors, sizes, textStyles } = tokens.modes.Light;

/** One row is 8 above the 34 number, 8 below, and the 1 hairline above it: 51 from one row to the next. */
const rowPitch = 51;
const shift = (translateY: number) => ({ transform: [{ translateY }] });
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

type Drag = { from: number; dy: number };

/**
 * Figma Batting order card (168:11316): one row per player with the order, jersey number, name, a position pill and a
 * drag handle. Dragging a handle moves that batter, and the rows it passes make room. VoiceOver moves a batter with
 * the handle's Move up and Move down actions.
 */
export function BattingOrder({ slots, onMove, onPickPosition, onDragging }: {
  slots: LineupSlot[];
  /** Must keep its identity between renders: a drag in progress calls it. */
  onMove: (from: number, to: number) => void;
  onPickPosition: (index: number) => void;
  /** True while a handle is held, so the page can stop scrolling under the finger. Must keep its identity too. */
  onDragging: (dragging: boolean) => void;
}) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const last = slots.length - 1;
  // A responder lives across the whole drag, so everything it calls must keep its identity until the drag ends:
  // `onMove` and `onDragging` are stable, and the responders are rebuilt only when the number of rows changes.
  const responders = useMemo(() => slots.map((_, index) => {
    const finish = (dy: number) => {
      const to = clamp(Math.round(index + dy / rowPitch), 0, last);
      setDrag(null);
      onDragging(false);
      if (to !== index) onMove(index, to);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { onDragging(true); setDrag({ from: index, dy: 0 }); },
      onPanResponderMove: (_, gesture) => setDrag({ from: index, dy: gesture.dy }),
      onPanResponderRelease: (_, gesture) => finish(gesture.dy),
      onPanResponderTerminate: () => finish(0),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [slots.length, onMove, onDragging]);

  const offset = (index: number) => {
    if (!drag) return 0;
    const to = clamp(Math.round(drag.from + drag.dy / rowPitch), 0, last);
    if (index === drag.from) return drag.dy;
    if (drag.from < to && index > drag.from && index <= to) return -rowPitch;
    if (drag.from > to && index >= to && index < drag.from) return rowPitch;
    return 0;
  };

  return (
    <View style={styles.card} testID="batting-order">
      {slots.map((slot, index) => {
        const { number, name } = rosterDisplay(slot.player);
        const label = positionLabel(slot.position);
        return (
          <View key={slot.player.id} style={[styles.row, index > 0 && styles.divided, drag?.from === index && styles.lifted, shift(offset(index))]} testID={`order-row-${index}`}>
            <Text style={styles.order}>{index + 1}</Text>
            <View style={styles.disc}><Text style={styles.number}>{number}</Text></View>
            <Text style={styles.name} numberOfLines={1}>{name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${label}. Change position`} hitSlop={sizes['space/2']}
              onPress={() => onPickPosition(index)} style={styles.pill} testID={`position-${index}`}>
              <Text style={slot.position === null ? styles.pillBatsOnly : styles.pillText}>{label}</Text>
            </Pressable>
            <View {...responders[index]!.panHandlers} accessible accessibilityLabel={`Reorder ${name}, batting ${index + 1}`}
              accessibilityActions={[{ name: 'decrement', label: 'Move up' }, { name: 'increment', label: 'Move down' }]}
              onAccessibilityAction={(event) => {
                const to = event.nativeEvent.actionName === 'decrement' ? index - 1 : index + 1;
                if (to >= 0 && to < slots.length) onMove(index, to);
              }} style={styles.handle} testID={`drag-handle-${index}`}>
              <DragHandleIcon />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = createStyles({
  card: { paddingLeft: sizes['space/4'], paddingRight: sizes['space/3'], paddingVertical: sizes['space/1'], borderRadius: sizes['radius/lg'], backgroundColor: colors['surface/card'], borderWidth: 1, borderColor: colors['border/subtle'] },
  row: { flexDirection: 'row', alignItems: 'center', gap: sizes['space/3'], paddingVertical: sizes['space/2'], backgroundColor: colors['surface/card'] },
  divided: { borderTopWidth: 1, borderTopColor: colors['border/subtle'] },
  lifted: { zIndex: 1, elevation: 4, shadowColor: colors['text/primary'], shadowOpacity: 0.18, shadowRadius: sizes['radius/sm'], shadowOffset: { width: 0, height: 2 } },
  order: { width: 18, ...textStyles.Caption, textAlign: 'right', color: colors['text/tertiary'] },
  disc: { width: sizes['chip/size'], height: sizes['chip/size'], borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'], alignItems: 'center', justifyContent: 'center' },
  number: { ...textStyles['Chip/Number'], color: colors['text/primary'] },
  name: { flex: 1, minWidth: 0, ...textStyles['Body/Strong'], color: colors['text/primary'] },
  pill: { paddingHorizontal: sizes['space/3'], paddingVertical: sizes['space/1'], borderRadius: sizes['radius/full'], backgroundColor: colors['surface/page'] },
  pillText: { ...textStyles.Caption, color: colors['text/primary'] },
  pillBatsOnly: { ...textStyles.Caption, color: colors['text/secondary'] },
  handle: { width: 18, height: 18 },
});
