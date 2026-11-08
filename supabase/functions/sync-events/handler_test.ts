import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { type Base, contentHash, type Store, type StoredGroup, syncEvents, type UploadRequest } from './handler.ts';
import { sampleHalfInning, sampleSetup } from '../../../packages/engine/scripts/sample-events.ts';
import { parseUploadRequest } from '../../../packages/engine/src/contract.ts';
import { replay } from '../../../packages/engine/src/engine.ts';
import type { Command, GameId, PlayerId, SessionId } from '../../../packages/engine/src/types.ts';
import { ENGINE_VERSION, EVENT_SCHEMA_VERSION } from '../../../packages/engine/src/version.ts';

const GAME = '11111111-1111-1111-1111-111111111111';
const SESSION = '22222222-2222-2222-2222-222222222222';
const NEW_SESSION = '33333333-3333-3333-3333-333333333333';
const USER = '00000000-0000-0000-0000-00000000000a';
const OTHER_USER = '00000000-0000-0000-0000-00000000000b';

const sample = sampleHalfInning({ gameId: GAME as GameId, sessionId: SESSION as SessionId, lockEpoch: 1 });
const [awayLineup, homeLineup] = sample.map(({ events }) => events[0].command);
const [awayLeadoff] = sampleSetup().roster.away;

function request(
  seq = 1, group = 'g1', commands: Command[] = [awayLineup], { sessionId = SESSION, lockEpoch = 1 } = {},
): UploadRequest {
  const parsed = parseUploadRequest({
    schemaVersion: EVENT_SCHEMA_VERSION,
    sessionId,
    events: commands.map((command, i) => ({
      id: `e${seq + i}`, gameId: GAME, seq: seq + i, group, lockEpoch, source: 'tap',
      at: '2026-10-23T18:00:00.000Z', command,
    })),
  });
  if (!parsed.ok) throw new Error('Invalid upload test fixture');
  return parsed.request;
}

function memoryStore() {
  const groups = new Map<string, StoredGroup>();
  const { rules, ...setup } = sampleSetup();
  const base: Base = {
    engineVersion: ENGINE_VERSION, schemaVersion: EVENT_SCHEMA_VERSION, rules, setup, revision: 0, state: null, events: [],
  };
  const session = { id: SESSION as string, userId: USER, epoch: 1 };
  const reads = { base: 0 };
  const store: Store = {
    findGroup: (_gameId, groupId) => Promise.resolve(groups.get(groupId) ?? null),
    sessionEpoch: (_gameId, sessionId, userId) =>
      Promise.resolve(sessionId === session.id && userId === session.userId ? session.epoch : null),
    getBase: () => {
      reads.base++;
      return Promise.resolve(structuredClone(base));
    },
    commitGroup: (commit) => {
      const groupId = commit.events[0].group;
      const saved = groups.get(groupId);
      if (saved) {
        return Promise.resolve(saved.userId === commit.userId && saved.contentHash === commit.contentHash
          ? { ok: true, revision: saved.ackRevision }
          : { ok: false, code: 'id_conflict' });
      }
      if (base.revision !== commit.baseRevision || commit.events[0].seq !== base.revision + 1) {
        return Promise.resolve({ ok: false, code: 'stale_revision' });
      }
      base.events.push(...structuredClone(commit.events));
      base.revision = commit.events.at(-1)!.seq;
      base.state = structuredClone(commit.newState);
      groups.set(groupId, {
        userId: commit.userId, contentHash: commit.contentHash, ackRevision: base.revision,
      });
      return Promise.resolve({ ok: true, revision: base.revision });
    },
  };
  return { store, groups, base, session, reads };
}

const takeOver = ({ session }: ReturnType<typeof memoryStore>, userId: string) => {
  Object.assign(session, { id: NEW_SESSION, userId, epoch: session.epoch + 1 });
};

const stored = ({ groups, base }: ReturnType<typeof memoryStore>) => structuredClone({ groups: [...groups], base });

async function sendAll(store: Store, requests: UploadRequest[]) {
  for (const r of requests) {
    deepStrictEqual(await syncEvents(USER, r, store), { ok: true, revision: r.events.at(-1)!.seq });
  }
}

function barrier() {
  const ready = Promise.withResolvers<void>();
  let arrivals = 0;
  return async () => {
    if (++arrivals === 2) ready.resolve();
    await ready.promise;
  };
}

async function race(secondUser = USER, secondRequest = request(), laterGroup = false) {
  const db = memoryStore();
  const bothMissing = barrier();
  const findGroup: Store['findGroup'] = async (gameId, groupId) => {
    const saved = await db.store.findGroup(gameId, groupId);
    if (!saved) await bothMissing();
    return saved;
  };
  const first = syncEvents(USER, request(), { ...db.store, findGroup });
  const second = syncEvents(secondUser, secondRequest, {
    ...db.store,
    findGroup,
    getBase: async (gameId) => {
      await first;
      if (laterGroup) {
        deepStrictEqual(await syncEvents(USER, request(2, 'g2', [homeLineup]), db.store), { ok: true, revision: 2 });
      }
      return db.store.getBase(gameId);
    },
  });
  const outcomes = await Promise.all([first, second]);
  return { ...db, outcomes };
}

Deno.test('concurrent identical uploads return the same acknowledgment and store one group', async () => {
  const { outcomes, groups, base } = await race();
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: true, revision: 1 }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
  strictEqual(base.revision, 1);
});

Deno.test('a concurrent upload with changed content returns id_conflict', async () => {
  const changed = request();
  changed.events[0].command = { kind: 'pitch', result: 'foul' };
  const { outcomes, groups, base } = await race(USER, changed);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: false, code: 'id_conflict' }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a concurrent upload from a user who is not the scorer returns stale_session', async () => {
  const { outcomes, groups, base } = await race(OTHER_USER);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: false, code: 'stale_session' }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a saved group uploaded again by another user returns id_conflict', async () => {
  const { store, groups, base } = memoryStore();
  deepStrictEqual(await syncEvents(USER, request(), store), { ok: true, revision: 1 });
  deepStrictEqual(await syncEvents(OTHER_USER, request(), store), { ok: false, code: 'id_conflict' });
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a concurrent retry returns its saved acknowledgment after a later group commits', async () => {
  const { outcomes, groups, base } = await race(USER, request(), true);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: true, revision: 1 }]);
  strictEqual(groups.size, 2);
  deepStrictEqual(base.events, [...request().events, ...request(2, 'g2', [homeLineup]).events]);
  strictEqual(base.revision, 2);
});

Deno.test('identical uploads that both read the old base still store only one group', async () => {
  const { store, groups, base } = memoryStore();
  const bothRead = barrier();
  const concurrentStore: Store = {
    ...store,
    getBase: async (gameId) => {
      const snapshot = await store.getBase(gameId);
      await bothRead();
      return snapshot;
    },
  };
  const outcomes = await Promise.all([
    syncEvents(USER, request(), concurrentStore), syncEvents(USER, request(), concurrentStore),
  ]);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: true, revision: 1 }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a changed illegal upload that read the old base returns id_conflict once its group commits', async () => {
  const { store, groups, base } = memoryStore();
  const changed = request();
  changed.events[0].command = { kind: 'pitch', result: 'foul' };
  deepStrictEqual(await syncEvents(USER, changed, memoryStore().store), {
    ok: false, code: 'rejected', reason: 'game_not_started',
  });
  const bothRead = barrier();
  const readOldBase: Store['getBase'] = async (gameId) => {
    const snapshot = await store.getBase(gameId);
    await bothRead();
    return snapshot;
  };
  const legal = syncEvents(USER, request(), { ...store, getBase: readOldBase });
  let changedRead = false;
  const illegal = syncEvents(USER, changed, {
    ...store,
    getBase: async (gameId) => {
      const snapshot = await readOldBase(gameId);
      changedRead = true;
      return snapshot;
    },
    findGroup: async (gameId, groupId) => {
      if (changedRead) await legal;
      return store.findGroup(gameId, groupId);
    },
  });
  deepStrictEqual(await Promise.all([legal, illegal]), [{ ok: true, revision: 1 }, { ok: false, code: 'id_conflict' }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
  strictEqual(base.revision, 1);
});

Deno.test('a missing group at an old or future sequence remains stale_revision', async () => {
  const { store, groups, base } = memoryStore();
  deepStrictEqual(await syncEvents(USER, request(), store), { ok: true, revision: 1 });
  for (const seq of [1, 3]) {
    deepStrictEqual(await syncEvents(USER, request(seq, 'missing'), store), {
      ok: false, code: 'stale_revision',
    });
  }
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a saved retry ignores later revisions and command key ordering', async () => {
  const { store, groups, base } = memoryStore();
  deepStrictEqual(await syncEvents(USER, request(), store), { ok: true, revision: 1 });
  deepStrictEqual(await syncEvents(USER, request(2, 'g2', [homeLineup]), store), { ok: true, revision: 2 });
  const reordered = request();
  reordered.events[0].command = Object.fromEntries(Object.entries(awayLineup).reverse()) as Command;
  deepStrictEqual(await syncEvents(USER, reordered, store), { ok: true, revision: 1 });
  strictEqual(groups.size, 2);
  strictEqual(base.events.length, 2);
});

Deno.test('invalid input saves no group or events', async () => {
  const { store, groups, base } = memoryStore();
  deepStrictEqual(await syncEvents(USER, { schemaVersion: EVENT_SCHEMA_VERSION, sessionId: 'invalid', events: [] }, store), {
    ok: false, code: 'invalid',
  });
  strictEqual(groups.size, 0);
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
});

Deno.test('an upload without a schemaVersion is unsupported_version, even when its commands are unreadable', async () => {
  const { store, groups, base } = memoryStore();
  const { schemaVersion: _, ...legacy } = request();
  for (const body of [legacy, { ...legacy, events: [{ ...legacy.events[0], command: { kind: 'nope' } }] }]) {
    deepStrictEqual(await syncEvents(USER, body, store), { ok: false, code: 'unsupported_version' });
  }
  strictEqual(groups.size, 0);
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
});

Deno.test('a game pinned to a different schema version is unsupported_version', async () => {
  const { store, groups, base } = memoryStore();
  base.schemaVersion = EVENT_SCHEMA_VERSION + 1;
  deepStrictEqual(await syncEvents(USER, request(), store), { ok: false, code: 'unsupported_version' });
  strictEqual(groups.size, 0);
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
});

Deno.test('malformed commands are invalid before any store access', async () => {
  const untouched: Store = {
    findGroup: () => Promise.reject(new Error('findGroup called')),
    sessionEpoch: () => Promise.reject(new Error('sessionEpoch called')),
    getBase: () => Promise.reject(new Error('getBase called')),
    commitGroup: () => Promise.reject(new Error('commitGroup called')),
  };
  for (const command of [
    { kind: 'pitch' },
    { kind: 'future_command' },
    { kind: 'runner', event: 'stolen_base', runner: { kind: 'player' }, to: 2 },
    { kind: 'game', control: { kind: 'lineup_set', side: 'home', lineup: [{ position: null }] } },
    { kind: 'correct', target: 'g0', replacement: [{ kind: 'pitch', result: 1 }] },
  ]) {
    const body = request();
    const events = [{ ...body.events[0], command }];
    deepStrictEqual(await syncEvents(USER, { ...body, events }, untouched), { ok: false, code: 'invalid' });
  }
});

Deno.test('saved retries retain hashes of unknown command and nested fields', async () => {
  const { store, groups, base } = memoryStore();
  const body = request();
  body.events[0].command = {
    kind: 'correct', target: body.events[0].group,
    replacement: [{
      kind: 'runner', event: 'stolen_base', to: 2,
      runner: Object.assign({ kind: 'player' as const, id: 'player-1' as PlayerId }, { note: ['retained'] }),
    }],
  };
  Object.assign(body.events[0].command, { future: { retained: true } });
  const originalHash = await contentHash(body.events);
  groups.set(body.events[0].group, { userId: USER, contentHash: originalHash, ackRevision: 1 });
  deepStrictEqual(await syncEvents(USER, body, store), { ok: true, revision: 1 });
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
  Object.assign(body.events[0].command, { future: { retained: false } });
  deepStrictEqual(await syncEvents(USER, body, store), { ok: false, code: 'id_conflict' });
});

Deno.test('input the database cannot store is invalid before it reaches the database', async () => {
  const untouched: Store = {
    findGroup: () => Promise.reject(new Error('findGroup called')),
    sessionEpoch: () => Promise.reject(new Error('sessionEpoch called')),
    getBase: () => Promise.reject(new Error('getBase called')),
    commitGroup: () => Promise.reject(new Error('commitGroup called')),
  };
  const withEvent = (change: Record<string, unknown>) => {
    const body = request();
    Object.assign(body.events[0], change);
    return body;
  };
  const cases = {
    'seq past the integer range': withEvent({ seq: 2 ** 31 }),
    'lockEpoch past the integer range': withEvent({ lockEpoch: 2 ** 31 }),
    'a null character in an ID': withEvent({ id: 'e\u00001' }),
    'a null character deep in a command': withEvent({ command: { kind: 'pitch', note: ['a\u0000b'] } }),
    'a null character in a command key': withEvent({ command: { kind: 'pitch', ['k\u0000']: 1 } }),
    'a null character in at': withEvent({ at: '2026-10-23T18:00:00.000Z\u0000' }),
    'an oversized event ID': withEvent({ id: 'e'.repeat(129) }),
    'an oversized group ID': withEvent({ group: 'g'.repeat(129) }),
  };
  for (const [name, body] of Object.entries(cases)) {
    deepStrictEqual(await syncEvents(USER, body, untouched), { ok: false, code: 'invalid' }, name);
  }
});

Deno.test('out classification roundtrips and changed classification conflicts with the saved play', async () => {
  const { store, groups, base } = memoryStore();
  const runnerOnFirst = sample.slice(0, 6);
  await sendAll(store, runnerOnFirst);
  const original = request(base.revision + 1, 'force-out', [
    { kind: 'pitch', result: 'in_play' },
    {
      kind: 'ball_in_play', outcome: 'fielders_choice', trajectory: 'ground', fielders: ['SS', '2B'],
      advances: [{ runner: awayLeadoff, to: 'out', outType: 'force' }],
    },
  ]);
  const accepted = { ok: true, revision: original.events[1].seq };
  const wire = JSON.parse(JSON.stringify(original));
  deepStrictEqual(parseUploadRequest(wire), { ok: true, request: original });
  deepStrictEqual(await syncEvents(USER, wire, store), accepted);
  const history = [...runnerOnFirst.flatMap((r) => r.events), ...original.events];
  deepStrictEqual(base.events, history);
  deepStrictEqual(await syncEvents(USER, JSON.parse(JSON.stringify(wire)), store), accepted);
  const changed = structuredClone(wire);
  changed.events[1].command.advances[0].outType = 'non_force';
  strictEqual(await contentHash(changed.events) === await contentHash(original.events), false);
  deepStrictEqual(await syncEvents(USER, changed, store), { ok: false, code: 'id_conflict' });
  strictEqual(groups.size, runnerOnFirst.length + 1);
  deepStrictEqual(base.events, history);
});

Deno.test('the sample half-inning is accepted in order and its state is the replay of its events', async () => {
  const db = memoryStore();
  await sendAll(db.store, sample);
  const events = sample.flatMap((r) => r.events);
  const replayed = replay(sampleSetup(), events);
  if (!replayed.ok) throw new Error('The sample half-inning does not replay');
  strictEqual(db.base.revision, events.at(-1)!.seq);
  deepStrictEqual(db.base.events, events);
  deepStrictEqual(db.base.state, replayed.state);
  strictEqual(db.groups.size, sample.length);
});

Deno.test('sending the sample half-inning again returns the same acknowledgments and stores nothing new', async () => {
  const db = memoryStore();
  await sendAll(db.store, sample);
  const saved = stored(db);
  await sendAll(db.store, sample);
  deepStrictEqual(stored(db), saved);
});

Deno.test('an illegal group is rejected with the engine reason, stores nothing, and leaves the game playable', async () => {
  const ball: Command = { kind: 'pitch', result: 'ball' };
  const cases: { name: string; played: number; commands: Command[]; reason: string }[] = [
    { name: 'a pitch before the game starts', played: 0, commands: [ball], reason: 'game_not_started' },
    {
      name: 'a runner who is not on base', played: 3, reason: 'runner_not_on_base',
      commands: [{ kind: 'runner', event: 'stolen_base', runner: awayLeadoff, to: 2 }],
    },
    {
      name: 'a legal pitch followed by a ball in play with no in-play pitch', played: 3, reason: 'ball_in_play_needs_pitch',
      commands: [ball, { kind: 'ball_in_play', outcome: 'single', trajectory: 'line', fielders: ['LF'], advances: [] }],
    },
  ];
  for (const { name, played, commands, reason } of cases) {
    const db = memoryStore();
    await sendAll(db.store, sample.slice(0, played));
    const saved = stored(db);
    deepStrictEqual(
      await syncEvents(USER, request(db.base.revision + 1, 'illegal', commands), db.store),
      { ok: false, code: 'rejected', reason },
      name,
    );
    deepStrictEqual(stored(db), saved, name);
    await sendAll(db.store, sample.slice(played));
    strictEqual(db.base.revision, sample.flatMap((r) => r.events).length, name);
  }
});

const runnerNotOnBase: Command[] = [{ kind: 'runner', event: 'stolen_base', runner: awayLeadoff, to: 2 }];
const legalNext = sample[3].events.map((e) => e.command);

const notTheScorer = [
  { name: 'another user on the scorer session', userId: OTHER_USER },
  { name: 'another user on a session of its own', userId: OTHER_USER, sessionId: NEW_SESSION },
];
const staleSession = [
  { name: 'the scorer after another user took over', userId: USER, takeOverBy: OTHER_USER },
  { name: 'the scorer on its old session after taking over again', userId: USER, takeOverBy: USER },
  { name: 'the new scorer on the old lock epoch', userId: OTHER_USER, sessionId: NEW_SESSION, takeOverBy: OTHER_USER },
];

async function staleSessionBeforeTheEngine(
  callers: { name: string; userId: string; sessionId?: string; takeOverBy?: string }[],
  commands: Command[],
) {
  for (const { name, userId, sessionId, takeOverBy } of callers) {
    const db = memoryStore();
    await sendAll(db.store, sample.slice(0, 3));
    if (takeOverBy) takeOver(db, takeOverBy);
    const saved = stored(db);
    const baseReads = db.reads.base;
    deepStrictEqual(
      await syncEvents(userId, request(db.base.revision + 1, 'next', commands, { sessionId }), db.store),
      { ok: false, code: 'stale_session' },
      name,
    );
    deepStrictEqual(stored(db), saved, name);
    strictEqual(db.reads.base, baseReads, name);
  }
}

Deno.test('a user who is not the scorer gets stale_session for an illegal play, with no engine reason', () =>
  staleSessionBeforeTheEngine(notTheScorer, runnerNotOnBase));

Deno.test('a stale session gets stale_session for an illegal play, with no engine reason', () =>
  staleSessionBeforeTheEngine(staleSession, runnerNotOnBase));

Deno.test('a caller who does not hold scoring gets stale_session for a legal play and nothing is saved', () =>
  staleSessionBeforeTheEngine([...notTheScorer, ...staleSession], legalNext));

Deno.test('an accepted group is acknowledged again to its scorer after a takeover', async () => {
  const db = memoryStore();
  await sendAll(db.store, sample.slice(0, 3));
  takeOver(db, OTHER_USER);
  const saved = stored(db);
  const baseReads = db.reads.base;
  deepStrictEqual(await syncEvents(USER, sample[2], db.store), { ok: true, revision: 3 });
  deepStrictEqual(stored(db), saved);
  strictEqual(db.reads.base, baseReads);
});

Deno.test('after a takeover the new session scores with the new lock epoch', async () => {
  const db = memoryStore();
  await sendAll(db.store, sample.slice(0, 3));
  takeOver(db, OTHER_USER);
  const next = request(4, 'next', legalNext, { sessionId: NEW_SESSION, lockEpoch: db.session.epoch });
  deepStrictEqual(await syncEvents(OTHER_USER, next, db.store), { ok: true, revision: 4 });
  strictEqual(db.groups.size, 4);
});

Deno.test('a game pinned to 0.1.1 still takes uploads, since this engine replays 0.1.1 games', async () => {
  const { store, groups, base } = memoryStore();
  base.engineVersion = '0.1.1';
  await sendAll(store, sample.slice(0, 5));
  strictEqual(groups.size, 5);
  strictEqual(base.revision, 5);
  strictEqual(base.engineVersion, '0.1.1');
});

Deno.test('a Fix on a game pinned to 0.1.1 is applied, as this engine continues the game under its own rules', async () => {
  const { store, base } = memoryStore();
  base.engineVersion = '0.1.1';
  await sendAll(store, sample.slice(0, 4));
  const fix = request(5, 'fix', [{ kind: 'correct', target: sample[3].events[0].group, replacement: [{ kind: 'pitch', result: 'called_strike' }] }]);
  deepStrictEqual(await syncEvents(USER, fix, store), { ok: true, revision: 5 });
  const { rules, ...setup } = sampleSetup();
  const replayed = replay({ ...setup, rules }, base.events);
  deepStrictEqual(replayed.ok && replayed.state.count, { balls: 0, strikes: 1, pitches: 1 });
  deepStrictEqual(base.state, replayed.ok ? replayed.state : null);
  strictEqual(base.engineVersion, '0.1.1');
});

Deno.test('a game pinned to a different engine version is unsupported_version', async () => {
  const { store, groups, base } = memoryStore();
  base.engineVersion = '0.0.0';
  deepStrictEqual(await syncEvents(USER, request(), store), { ok: false, code: 'unsupported_version' });
  strictEqual(groups.size, 0);
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
});
