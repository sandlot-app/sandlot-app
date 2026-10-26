import { replay } from '@sandlot/engine';
import type { Command, Event, GameSetup, GameState, GroupId, Timestamp } from '@sandlot/engine';

export type SavedPlay = {
  id: GroupId;
  at: Timestamp;
  firstSeq: number;
  commands: readonly Command[];
  before: GameState;
  after: GameState;
  undone: boolean;
};

export function savedPlays(setup: GameSetup, groups: Event[][]): SavedPlay[] {
  const plays: SavedPlay[] = [];
  const events: Event[] = [];
  let previous = replay(setup, events);
  for (const group of groups) {
    const first = group[0]!;
    events.push(...group);
    const next = replay(setup, events);
    if (!previous.ok || !next.ok) throw new Error('Saved history could not be replayed');
    if (first.command.kind === 'undo') {
      const targetId = first.command.target;
      const target = plays.find((play) => play.id === targetId);
      if (target) target.undone = true;
    }
    plays.push({id: first.group, at: first.at, firstSeq: first.seq, commands: group.map((event) => event.command),
      before: previous.state, after: next.state, undone: false});
    previous = next;
  }
  return plays;
}
