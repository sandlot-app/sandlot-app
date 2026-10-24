import { describe, expect, it } from 'vitest';
import { parseUploadRequest } from '../src/contract.ts';
import type { Command } from '../src/types.ts';
import { EVENT_SCHEMA_VERSION } from '../src/version.ts';

const invalidUpload = { ok: false, code: 'invalid' };
const unsupportedUpload = { ok: false, code: 'unsupported_version' };
const parsed = (request: unknown) => ({ ok: true, request });

const player = { kind: 'player', id: 'player-1' } as const;
const opponent = { kind: 'opponent', id: 'opponent-1' } as const;

function upload(command: unknown = { kind: 'pitch', result: 'ball' }) {
  return {
    schemaVersion: EVENT_SCHEMA_VERSION,
    sessionId: '22222222-2222-2222-2222-222222222222',
    events: [{
      id: 'event-1', gameId: '11111111-1111-1111-1111-111111111111', seq: 1,
      group: 'play-1', lockEpoch: 1, source: 'tap', at: '2026-10-23T18:00:00.000Z', command,
    }],
  };
}

const examples = {
  pitch: { kind: 'pitch', result: 'ball' },
  ball_in_play: {
    kind: 'ball_in_play', outcome: 'single', trajectory: null, fielders: ['SS', '1B'],
    advances: [{ runner: player, to: 1 }, { runner: opponent, to: 'home' }],
  },
  runner: { kind: 'runner', event: 'stolen_base', runner: opponent, to: 2 },
  batter_out: { kind: 'batter_out', reason: 'thrown_bat' },
  substitution: { kind: 'substitution', side: 'home', change: { kind: 'pinch_hitter', in: player, out: opponent } },
  game: { kind: 'game', control: { kind: 'lineup_set', side: 'away', lineup: [{ player, position: null }, { player: opponent, position: 'P' }] } },
  undo: { kind: 'undo', target: 'earlier-play' },
  correct: { kind: 'correct', target: 'earlier-play', replacement: [{ kind: 'pitch', result: 'foul' }] },
} satisfies Record<Command['kind'], unknown>;

const substitutions = [
  ...['pinch_hitter', 'pinch_runner', 'courtesy_runner'].map((kind) => ({ kind, in: player, out: opponent })),
  { kind: 'defensive', in: opponent, position: 'ROVER' },
  { kind: 'pitching_change', in: player },
  { kind: 'late_arrival', in: opponent },
];
const controls = [
  examples.game.control,
  { kind: 'start', umpireStart: '2026-10-23T11:00:00-07:00' },
  ...['manual', 'time_limit'].map((reason) => ({ kind: 'end_half', reason })),
  ...['final', 'called', 'time_limit'].map((reason) => ({ kind: 'end_game', reason })),
];
const commands = [
  ...Object.values(examples),
  ...substitutions.map((change) => ({ kind: 'substitution', side: 'away', change })),
  ...controls.map((control) => ({ kind: 'game', control })),
];

function fieldPaths(value: unknown, path: string[] = []): string[][] {
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(Array.isArray(value) ? [] : [[...path, key]]), ...fieldPaths(item, [...path, key]),
  ]);
}

function changeField(value: unknown, path: string[], replace: boolean, replacement?: unknown) {
  const changed = structuredClone(value);
  let record = changed as Record<string, unknown>;
  for (const key of path.slice(0, -1)) record = record[key] as Record<string, unknown>;
  const key = path.at(-1)!;
  if (replace) record[key] = replacement;
  else delete record[key];
  return changed;
}

function withEvents(count: number, start = 1) {
  const body = upload();
  body.events = Array.from({ length: count }, (_, index) => ({ ...body.events[0]!, id: `event-${index}`, seq: start + index }));
  return body;
}

function withExtras(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withExtras);
  if (typeof value !== 'object' || value === null) return value;
  return { ...Object.fromEntries(Object.entries(value).map(([key, item]) => [key, withExtras(item)])), future: { retained: true } };
}

describe('parseUploadRequest', () => {
  it('rejects a pitch missing its result before it can enter the event log (docs/contract.md, Request and Engine boundary)', () => {
    const malformedUploadFixture = upload({ kind: 'pitch' });
    expect(parseUploadRequest(malformedUploadFixture)).toEqual(invalidUpload);
  });

  for (const command of commands) {
    it(`parses ${JSON.stringify(command)} without changing the payload`, () => {
      const body = upload(command);
      expect(parseUploadRequest(body)).toEqual(parsed(body));
    });

    for (const path of fieldPaths(command)) {
      const name = `${command.kind}.${path.join('.')}`;
      it(`rejects missing ${name}`, () => {
        expect(parseUploadRequest(upload(changeField(command, path, false)))).toEqual(invalidUpload);
      });
      it(`rejects the wrong type for ${name}`, () => {
        expect(parseUploadRequest(upload(changeField(command, path, true, 42)))).toEqual(invalidUpload);
      });
      if (path.at(-1) !== 'trajectory' && path.at(-1) !== 'position') {
        it(`rejects null ${name}`, () => {
          expect(parseUploadRequest(upload(changeField(command, path, true, null)))).toEqual(invalidUpload);
        });
      }
    }
  }

  it('checks each event field for presence and type', () => {
    for (const path of fieldPaths(upload()).filter((path) => path[0] !== 'schemaVersion' && !path.includes('command'))) {
      expect(parseUploadRequest(changeField(upload(), path, false)), path.join('.')).toEqual(invalidUpload);
      expect(parseUploadRequest(changeField(upload(), path, true, null)), path.join('.')).toEqual(invalidUpload);
      expect(parseUploadRequest(changeField(upload(), path, true, {})), path.join('.')).toEqual(invalidUpload);
    }
  });

  it('rejects unknown enum values at every command level', () => {
    const invalid = [
      { ...examples.pitch, kind: 'future_command' },
      { ...examples.pitch, result: 'strike' },
      { ...examples.ball_in_play, outcome: 'hit' },
      { ...examples.ball_in_play, trajectory: 'high' },
      { ...examples.ball_in_play, fielders: ['DH'] },
      { ...examples.ball_in_play, advances: [{ runner: player, to: 4 }] },
      { ...examples.runner, event: 'steal' },
      { ...examples.runner, to: '2' },
      { ...examples.runner, runner: { kind: 'guest', id: 'p' } },
      { ...examples.batter_out, reason: 'strikeout' },
      { ...examples.substitution, side: 'visitor' },
      { ...examples.substitution, change: { kind: 'trade', in: player } },
      { ...examples.substitution, change: { kind: 'defensive', in: player, position: null } },
      { kind: 'game', control: { kind: 'pause' } },
      { kind: 'game', control: { ...examples.game.control, side: 'visitor' } },
      { kind: 'game', control: { ...examples.game.control, lineup: [{ player, position: 'DH' }] } },
      { kind: 'game', control: { kind: 'end_half', reason: 'final' } },
      { kind: 'game', control: { kind: 'end_game', reason: 'manual' } },
    ];
    for (const command of invalid) expect(parseUploadRequest(upload(command)), JSON.stringify(command)).toEqual(invalidUpload);
  });

  it('accepts all legal literal values without imposing baseball legality', () => {
    const valid = [
      ...['ball', 'called_strike', 'swinging_strike', 'foul', 'foul_tip', 'hit_by_pitch', 'in_play'].map((result) => ({ ...examples.pitch, result })),
      ...['single', 'double', 'ground_rule_double', 'triple', 'home_run', 'out', 'error', 'fielders_choice', 'sacrifice_fly', 'sacrifice_bunt', 'double_play', 'triple_play'].map((outcome) => ({ ...examples.ball_in_play, outcome })),
      ...['ground', 'line', 'fly', 'popup', 'bunt'].map((trajectory) => ({ ...examples.ball_in_play, trajectory })),
      { ...examples.ball_in_play, fielders: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'ROVER'] },
      ...['stolen_base', 'caught_stealing', 'pickoff', 'wild_pitch', 'passed_ball', 'balk', 'advance_on_error', 'defensive_indifference', 'left_early', 'missed_base'].map((event) => ({ ...examples.runner, event })),
      ...[1, 2, 3, 'home', 'out'].flatMap((to) => [
        { ...examples.runner, to }, { ...examples.ball_in_play, advances: [{ runner: player, to }] },
      ]),
      ...['thrown_bat', 'batting_out_of_order', 'max_pitches'].map((reason) => ({ ...examples.batter_out, reason })),
      { ...examples.ball_in_play, fielders: [], advances: [] },
      { kind: 'game', control: { ...examples.game.control, lineup: [] } },
      { ...examples.correct, replacement: [] },
    ];
    for (const command of valid) expect(parseUploadRequest(upload(command))).toEqual(parsed(upload(command)));
  });

  it('validates corrections recursively, including nested corrections', () => {
    const nested = { ...examples.correct, replacement: [{ ...examples.correct, replacement: commands }] };
    expect(parseUploadRequest(upload(nested))).toEqual(parsed(upload(nested)));
    for (const invalid of [null, {}, { kind: 'pitch' }, { ...examples.runner, runner: { kind: 'player' } }]) {
      expect(parseUploadRequest(upload({ ...examples.correct, replacement: [{ ...examples.correct, replacement: [invalid] }] }))).toEqual(invalidUpload);
    }
  });

  it('requires nonempty identifiers and timestamps, and limits IDs to 128 characters', () => {
    const paths = [
      ['events', '0', 'id'], ['events', '0', 'group'], ['events', '0', 'at'],
      ['events', '0', 'command', 'target'],
    ];
    for (const path of paths) {
      expect(parseUploadRequest(changeField(upload(examples.undo), path, true, ''))).toEqual(invalidUpload);
      if (path.at(-1) === 'at') continue;
      expect(parseUploadRequest(changeField(upload(examples.undo), path, true, 'x'.repeat(128)))).toMatchObject({ ok: true });
      expect(parseUploadRequest(changeField(upload(examples.undo), path, true, 'x'.repeat(129)))).toEqual(invalidUpload);
    }
    for (const kind of ['player', 'opponent']) {
      for (const id of ['', null, 1]) {
        expect(parseUploadRequest(upload({ ...examples.runner, runner: { kind, id } }))).toEqual(invalidUpload);
      }
      const command = { ...examples.runner, runner: { kind, id: 'x'.repeat(129) } };
      expect(parseUploadRequest(upload(command))).toEqual(parsed(upload(command)));
    }
    expect(parseUploadRequest(upload({ kind: 'game', control: { kind: 'start', umpireStart: '' } }))).toEqual(invalidUpload);
  });

  it('keeps timestamp text verbatim and accepts voice', () => {
    const body = upload({ kind: 'game', control: { kind: 'start', umpireStart: 'provided start text' } });
    body.events[0]!.at = '2026-10-23T11:00:00-07:00';
    body.events[0]!.source = 'voice';
    expect(parseUploadRequest(body)).toEqual(parsed(body));
  });

  it('requires UUID session/game IDs and a known source', () => {
    for (const path of [['sessionId'], ['events', '0', 'gameId']]) {
      for (const value of ['', 'not-a-uuid', '11111111111111111111111111111111', null, 1]) {
        expect(parseUploadRequest(changeField(upload(), path, true, value))).toEqual(invalidUpload);
      }
    }
    expect(parseUploadRequest(changeField(upload(), ['events', '0', 'source'], true, 'ai'))).toEqual(invalidUpload);
  });

  it('requires positive postgres integers for sequences and epochs', () => {
    for (const field of ['seq', 'lockEpoch']) {
      for (const value of [0, -1, 1.1, 2 ** 31, Infinity, NaN, '1']) {
        expect(parseUploadRequest(changeField(upload(), ['events', '0', field], true, value))).toEqual(invalidUpload);
      }
      expect(parseUploadRequest(changeField(upload(), ['events', '0', field], true, 2 ** 31 - 1))).toMatchObject({ ok: true });
    }
    expect(parseUploadRequest(withEvents(2, 2 ** 31 - 1))).toEqual(invalidUpload);
  });

  it('accepts one to twenty events with consecutive sequences starting above one', () => {
    expect(parseUploadRequest(withEvents(1))).toEqual(parsed(withEvents(1)));
    expect(parseUploadRequest(withEvents(20, 101))).toEqual(parsed(withEvents(20, 101)));
    expect(parseUploadRequest(withEvents(0))).toEqual(invalidUpload);
    expect(parseUploadRequest(withEvents(21))).toEqual(invalidUpload);
  });

  it('requires a shared game, play, epoch and timestamp, consecutive sequences and unique IDs', () => {
    const cases = { gameId: '33333333-3333-3333-3333-333333333333', group: 'other', lockEpoch: 2, at: 'other-time', seq: 3, id: 'event-0' };
    for (const [field, value] of Object.entries(cases)) {
      expect(parseUploadRequest(changeField(withEvents(2), ['events', '1', field], true, value)), field).toEqual(invalidUpload);
    }
    expect(parseUploadRequest(changeField(withEvents(2), ['events', '1', 'seq'], true, 1))).toEqual(invalidUpload);
  });

  it('returns unsupported_version when schemaVersion is missing or not the current version', () => {
    expect(parseUploadRequest(changeField(upload(), ['schemaVersion'], false))).toEqual(unsupportedUpload);
    for (const value of [EVENT_SCHEMA_VERSION - 1, EVENT_SCHEMA_VERSION + 1, 0, -1, 1.5, String(EVENT_SCHEMA_VERSION), null, true, [EVENT_SCHEMA_VERSION], {}]) {
      expect(parseUploadRequest(changeField(upload(), ['schemaVersion'], true, value)), JSON.stringify(value)).toEqual(unsupportedUpload);
    }
  });

  it('checks schemaVersion before anything a schema version could change', () => {
    const malformed = [
      upload({ kind: 'nope' }),
      upload({ kind: 'pitch' }),
      upload(null),
      { ...upload(), sessionId: 'not-a-uuid' },
      { ...upload(), events: [null] },
      withEvents(21),
    ];
    for (const body of malformed) {
      const name = JSON.stringify(body);
      expect(parseUploadRequest(changeField(body, ['schemaVersion'], false)), name).toEqual(unsupportedUpload);
      expect(parseUploadRequest({ ...body, schemaVersion: EVENT_SCHEMA_VERSION + 1 }), name).toEqual(unsupportedUpload);
      expect(parseUploadRequest({ ...body, schemaVersion: EVENT_SCHEMA_VERSION }), name).toEqual(invalidUpload);
    }
  });

  it('returns invalid, not unsupported_version, for a body that is not an upload envelope', () => {
    const notUploads = [
      {},
      changeField(upload(), ['sessionId'], false),
      { ...upload(), sessionId: '' },
      changeField(upload(), ['events'], false),
      { ...upload(), events: 'events' },
      { ...upload(), events: [] },
    ];
    for (const body of notUploads) {
      const name = JSON.stringify(body);
      expect(parseUploadRequest(changeField(body, ['schemaVersion'], false)), name).toEqual(invalidUpload);
      expect(parseUploadRequest(changeField(body, ['schemaVersion'], true, EVENT_SCHEMA_VERSION + 1)), name).toEqual(invalidUpload);
    }
  });

  it('rejects nonrecords and nonarrays at the boundary', () => {
    for (const value of [null, false, 1, 'text', [], undefined]) expect(parseUploadRequest(value)).toEqual(invalidUpload);
    for (const value of [null, {}, 'events', [null], [[]], [42]]) {
      expect(parseUploadRequest({ ...upload(), events: value })).toEqual(invalidUpload);
    }
    for (const command of [null, false, 1, 'pitch', [], {}]) expect(parseUploadRequest(upload(command))).toEqual(invalidUpload);
  });

  it('preserves unknown command and nested fields used by existing content hashes', () => {
    for (const command of commands.map(withExtras)) {
      expect(parseUploadRequest(upload(command))).toEqual(parsed(upload(command)));
    }
  });

  it('rejects U+0000 even in unknown nested fields and object keys', () => {
    for (const command of [
      { ...examples.pitch, extra: { nested: ['bad\0text'] } },
      { ...examples.pitch, extra: { ['bad\0key']: 'value' } },
      { ...examples.runner, runner: { ...player, id: 'bad\0id' } },
      { kind: 'game', control: { kind: 'start', umpireStart: 'bad\0time' } },
    ]) expect(parseUploadRequest(upload(command))).toEqual(invalidUpload);
    for (const field of ['id', 'group', 'at']) {
      expect(parseUploadRequest(changeField(upload(), ['events', '0', field], true, 'bad\0text'))).toEqual(invalidUpload);
    }
    expect(parseUploadRequest({ ...upload(), events: [{ ...upload().events[0], extra: { ['bad\0key']: 1 } }] })).toEqual(invalidUpload);
  });
});
