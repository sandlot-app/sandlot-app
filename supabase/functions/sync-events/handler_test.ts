import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { type Base, contentHash, type Store, type StoredGroup, syncEvents, type UploadRequest } from './handler.ts';
import { parseUploadRequest } from '../../../packages/engine/src/contract.ts';
import type { PlayerId } from '../../../packages/engine/src/types.ts';

const GAME = '11111111-1111-1111-1111-111111111111';
const USER = '00000000-0000-0000-0000-00000000000a';
const OTHER_USER = '00000000-0000-0000-0000-00000000000b';

function request(seq = 1, group = 'g1'): UploadRequest {
  const parsed = parseUploadRequest({
    sessionId: '22222222-2222-2222-2222-222222222222',
    events: [{
      id: `e${seq}`, gameId: GAME, seq, group, lockEpoch: 1, source: 'tap',
      at: '2026-10-23T18:00:00.000Z', command: { kind: 'pitch', result: 'ball' },
    }],
  });
  if (!parsed) throw new Error('Invalid upload test fixture');
  return parsed;
}

function memoryStore() {
  const groups = new Map<string, StoredGroup>();
  const base: Base = { revision: 0, state: {}, events: [] };
  const store: Store = {
    findGroup: (_gameId, groupId) => Promise.resolve(groups.get(groupId) ?? null),
    getBase: () => Promise.resolve(structuredClone(base)),
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
  return { store, groups, base };
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
        deepStrictEqual(await syncEvents(USER, request(2, 'g2'), db.store), { ok: true, revision: 2 });
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

Deno.test('a concurrent upload from another user returns id_conflict', async () => {
  const { outcomes, groups, base } = await race(OTHER_USER);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: false, code: 'id_conflict' }]);
  strictEqual(groups.size, 1);
  deepStrictEqual(base.events, request().events);
});

Deno.test('a concurrent retry returns its saved acknowledgment after a later group commits', async () => {
  const { outcomes, groups, base } = await race(USER, request(), true);
  deepStrictEqual(outcomes, [{ ok: true, revision: 1 }, { ok: true, revision: 1 }]);
  strictEqual(groups.size, 2);
  deepStrictEqual(base.events, [...request().events, ...request(2, 'g2').events]);
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
  deepStrictEqual(await syncEvents(USER, request(2, 'g2'), store), { ok: true, revision: 2 });
  const reordered = request();
  reordered.events[0].command = { result: 'ball', kind: 'pitch' };
  deepStrictEqual(await syncEvents(USER, reordered, store), { ok: true, revision: 1 });
  strictEqual(groups.size, 2);
  strictEqual(base.events.length, 2);
});

Deno.test('invalid input saves no group or events', async () => {
  const { store, groups, base } = memoryStore();
  deepStrictEqual(await syncEvents(USER, { sessionId: 'invalid', events: [] }, store), {
    ok: false, code: 'invalid',
  });
  strictEqual(groups.size, 0);
  deepStrictEqual(base.events, []);
  strictEqual(base.revision, 0);
});

Deno.test('malformed commands are invalid before any store access', async () => {
  const untouched: Store = {
    findGroup: () => Promise.reject(new Error('findGroup called')),
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
