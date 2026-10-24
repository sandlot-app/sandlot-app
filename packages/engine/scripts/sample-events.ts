// Prints a hand-built half-inning as UploadRequest[] for the first connection test in docs/contract.md.
// Usage: pnpm -s --filter @sandlot/engine sample-events --game <id> --session <id> [--epoch 1]
// Every run with the same arguments prints the same requests, so a second send must add nothing.
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import type {
  Command,
  Event,
  EventId,
  GameId,
  GroupId,
  LineupSlot,
  OpponentId,
  PlayerId,
  PlayerRef,
  Position,
  SessionId,
  Timestamp,
  UploadRequest,
} from '../src/index.ts';
import { EVENT_SCHEMA_VERSION } from '../src/index.ts';

export type SampleOptions = { gameId: GameId; sessionId: SessionId; lockEpoch: number };

const POSITIONS: Position[] = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const FIRST_PLAY_AT = Date.parse('2026-10-25T17:00:00.000Z');
const SECONDS_BETWEEN_PLAYS = 20;

const home = (n: number): PlayerRef => ({ kind: 'player', id: `home-${n}` as PlayerId });
const away = (n: number): PlayerRef => ({ kind: 'opponent', id: `away-${n}` as OpponentId });
const lineup = (ref: (n: number) => PlayerRef): LineupSlot[] =>
  POSITIONS.map((position, i) => ({ player: ref(i + 1), position }));

/** The plays of the half-inning, in order. Each inner list is one play. */
function plays(at: (play: number) => Timestamp): Command[][] {
  const pitch = (result: Extract<Command, { kind: 'pitch' }>['result']): Command => ({ kind: 'pitch', result });
  return [
    [{ kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: lineup(away) } }],
    [{ kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: lineup(home) } }],
    [{ kind: 'game', control: { kind: 'start', umpireStart: at(2) } }],
    // away-1: ball, called strike, single to left, then steals second.
    [pitch('ball')],
    [pitch('called_strike')],
    [pitch('in_play'), { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] }],
    [{ kind: 'runner', event: 'stolen_base', runner: away(1), to: 2 }],
    // away-2 strikes out swinging.
    [pitch('called_strike')],
    [pitch('swinging_strike')],
    [pitch('swinging_strike')],
    // away-3 grounds out to second, and the runner moves to third.
    [
      pitch('in_play'),
      { kind: 'ball_in_play', outcome: 'out', trajectory: 'ground', fielders: ['2B', '1B'], advances: [{ runner: away(1), to: 3 }] },
    ],
    // away-4 flies out to center for the third out.
    [pitch('in_play'), { kind: 'ball_in_play', outcome: 'out', trajectory: 'fly', fielders: ['CF'], advances: [] }],
  ];
}

/** A UUID-shaped ID that depends only on its inputs. */
function stableId(...parts: (string | number)[]): string {
  const hex = createHash('sha256').update(parts.join(':')).digest('hex');
  const variant = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function sampleHalfInning({ gameId, sessionId, lockEpoch }: SampleOptions): UploadRequest[] {
  const at = (play: number) => new Date(FIRST_PLAY_AT + play * SECONDS_BETWEEN_PLAYS * 1000).toISOString() as Timestamp;
  let seq = 0;
  return plays(at).map((commands, play) => {
    const group = stableId(gameId, 'group', play) as GroupId;
    const events = commands.map((command): Event => {
      seq += 1;
      return {
        id: stableId(gameId, 'event', seq) as EventId,
        gameId,
        seq,
        group,
        lockEpoch,
        source: 'tap',
        at: at(play),
        command,
      };
    });
    return { schemaVersion: EVENT_SCHEMA_VERSION, sessionId, events };
  });
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: { game: { type: 'string' }, session: { type: 'string' }, epoch: { type: 'string', default: '1' } },
  });
  if (!values.game || !values.session) {
    console.error('Usage: pnpm -s --filter @sandlot/engine sample-events --game <id> --session <id> [--epoch 1]');
    process.exit(2);
  }
  const requests = sampleHalfInning({
    gameId: values.game as GameId,
    sessionId: values.session as SessionId,
    lockEpoch: Number(values.epoch),
  });
  console.log(JSON.stringify(requests, null, 2));
}
