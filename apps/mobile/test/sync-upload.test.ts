import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { applyGroup, type Event, type UploadRequest } from '@sandlot/engine';
import { demoSetup } from '../src/scoring/demo-game.ts';
import { openOfflineGame, type ServerGame } from '../src/scoring/offline-game.ts';
import { uploadWaiting, type Send } from '../src/sync/upload.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-27T17:00:00.000Z' };
const server: ServerGame = { gameId: '6f1d2c4e-0000-4000-8000-000000000001', sessionId: '6f1d2c4e-0000-4000-8000-0000000000a1', lockEpoch: 1 };

/**
 * A server that follows docs/contract.md's handler steps for one game: a known group answers with its stored
 * acknowledgment (or id_conflict if its content changed), a new group must start at revision + 1, and the engine
 * decides whether it is legal. `loseNext` commits the next group and then drops its response, as a lost connection does.
 */
function fakeServer() {
  const groups = new Map<string, { content: string; revision: number }>();
  const events: Event[] = [];
  const state = { loseNext: false, offline: false, expiredToken: false, requests: 0, tokens: [] as boolean[] };
  const send: Send = async (request: UploadRequest, fresh: boolean) => {
    state.requests += 1;
    state.tokens.push(fresh);
    if (state.offline) return null;
    if (state.expiredToken && !fresh) return { status: 401, body: { error: 'unauthenticated' } };
    if (request.sessionId !== server.sessionId) return { status: 403, body: { error: 'stale_session' } };
    const group = request.events[0]!.group;
    const content = JSON.stringify(request.events);
    const known = groups.get(group);
    if (known) return known.content === content ? { status: 200, body: { revision: known.revision } } : { status: 409, body: { error: 'id_conflict' } };
    if (request.events[0]!.seq !== events.length + 1) return { status: 409, body: { error: 'stale_revision' } };
    const applied = applyGroup(demoSetup, events, request.events.map((event) => event.command));
    if (!applied.ok) return { status: 422, body: { error: 'rejected', reason: applied.code } };
    events.push(...request.events);
    groups.set(group, { content, revision: events.length });
    if (state.loseNext) {
      state.loseNext = false;
      return null;
    }
    return { status: 200, body: { revision: events.length } };
  };
  return { send, events, groups, state };
}

async function scorer() {
  const database = connect(':memory:');
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error('Session must open');
  const save = async (action: Parameters<typeof session.record>[0]) => {
    const result = await session.record(action);
    if (result.kind !== 'saved') throw new Error(`The play must save: ${JSON.stringify(result)}`);
    return result.game;
  };
  await save({ kind: 'start', server });
  return { session, save, database };
}

test('waiting plays upload in order, and the badge counts only what the server acknowledged', async () => {
  const { session, save } = await scorer();
  await save({ kind: 'pitch', result: 'ball' });
  await save({ kind: 'pitch', result: 'called_strike' });
  const fake = fakeServer();
  const result = await uploadWaiting(session, fake.send);
  assert.deepEqual(result.status, { kind: 'synced' });
  assert.equal(result.game?.waitingPlays, 0);
  assert.deepEqual(fake.events.map((event) => event.seq), [1, 2, 3, 4, 5]);
  assert.deepEqual(fake.events, result.game?.events, 'the server holds exactly the phone’s events');
});

test('a lost response is retried with the identical play, and the server adds nothing twice', async () => {
  const { session, save } = await scorer();
  const fake = fakeServer();
  await uploadWaiting(session, fake.send);
  await save({ kind: 'pitch', result: 'ball' });
  fake.state.loseNext = true;
  const lost = await uploadWaiting(session, fake.send);
  assert.deepEqual(lost.status, { kind: 'waiting' }, 'no answer means the play still waits');
  assert.equal(lost.game, null, 'nothing was acknowledged');
  assert.equal((await session.nextUpload())?.events[0]?.seq, 4);
  assert.equal(fake.events.length, 4, 'the server did commit it');
  const retried = await uploadWaiting(session, fake.send);
  assert.deepEqual(retried.status, { kind: 'synced' });
  assert.equal(retried.game?.waitingPlays, 0);
  assert.equal(fake.events.length, 4, 'the retry added no events');
  assert.equal(fake.groups.size, 2);
});

test('with no signal nothing is acknowledged, and the queue picks up where it stopped', async () => {
  const { session, save } = await scorer();
  const fake = fakeServer();
  fake.state.offline = true;
  await save({ kind: 'pitch', result: 'ball' });
  const offline = await uploadWaiting(session, fake.send);
  assert.deepEqual(offline.status, { kind: 'waiting' });
  assert.equal(offline.game, null);
  assert.equal((await session.nextUpload())?.events[0]?.seq, 1);
  fake.state.offline = false;
  assert.equal((await uploadWaiting(session, fake.send)).game?.waitingPlays, 0);
});

test('an expired sign-in is refreshed once and the same play is sent again', async () => {
  const { session } = await scorer();
  const fake = fakeServer();
  fake.state.expiredToken = true;
  const result = await uploadWaiting(session, fake.send);
  assert.deepEqual(result.status, { kind: 'synced' });
  assert.deepEqual(fake.state.tokens, [false, true]);
});

test('a rejected play stops the queue, keeps every later play on the phone, and says why', async () => {
  const { session, save } = await scorer();
  await save({ kind: 'pitch', result: 'ball' });
  await save({ kind: 'pitch', result: 'ball' });
  const fake = fakeServer();
  const real = fake.send;
  let calls = 0;
  const send: Send = async (request, fresh) => (++calls === 2 ? { status: 422, body: { error: 'rejected', reason: 'game_over' } } : real(request, fresh));
  const result = await uploadWaiting(session, send);
  assert.deepEqual(result.status, { kind: 'stopped', reason: 'rejected' });
  assert.equal(result.game?.waitingPlays, 2);
  assert.equal(calls, 2, 'nothing after the rejected play is sent');
  assert.equal(fake.events.length, 3);
});

test('each error the contract lists stops or waits as it says', async () => {
  const cases: [number, unknown, string][] = [
    [409, { error: 'unsupported_version' }, 'update_app'],
    [403, { error: 'stale_session' }, 'session'],
    [409, { error: 'stale_revision' }, 'conflict'],
    [409, { error: 'id_conflict' }, 'conflict'],
    [400, { error: 'invalid' }, 'conflict'],
    [422, { error: 'rejected', reason: 'too_many_outs' }, 'rejected'],
  ];
  for (const [status, body, reason] of cases) {
    const { session } = await scorer();
    const result = await uploadWaiting(session, async () => ({ status, body }));
    assert.deepEqual(result.status, { kind: 'stopped', reason }, `${status} ${JSON.stringify(body)}`);
    assert.equal((await session.nextUpload())?.events[0]?.seq, 1, 'the play stays on the phone');
  }
  for (const status of [500, 502, 503]) {
    const { session } = await scorer();
    assert.deepEqual((await uploadWaiting(session, async () => ({ status, body: null }))).status, { kind: 'waiting' }, `${status} retries later`);
  }
  const { session } = await scorer();
  const mismatch = await uploadWaiting(session, async () => ({ status: 200, body: { revision: 7 } }));
  assert.deepEqual(mismatch.status, { kind: 'stopped', reason: 'conflict' }, 'an acknowledgment for another revision is not taken');
  assert.equal(mismatch.game, null);
});

test('a local demo game has nothing to upload and never calls the server', async () => {
  const database = connect(':memory:');
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error('Session must open');
  await session.record({ kind: 'start' });
  let called = false;
  const result = await uploadWaiting(session, async () => { called = true; return null; });
  assert.deepEqual(result.status, { kind: 'synced' });
  assert.equal(called, false);
});
