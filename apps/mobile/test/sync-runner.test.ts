import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { openOfflineGame, type ServerGame } from '../src/scoring/offline-game.ts';
import { createUploadRunner } from '../src/sync/runner.ts';
import type { Send } from '../src/sync/upload.ts';
import { connect } from './database.ts';

const boundary = { newId: randomUUID, now: () => '2026-10-27T17:00:00.000Z' };
const server: ServerGame = { gameId: '6f1d2c4e-0000-4000-8000-000000000001', sessionId: '6f1d2c4e-0000-4000-8000-0000000000a1', lockEpoch: 1 };

async function liveGame() {
  const database = connect(':memory:');
  const session = await openOfflineGame(database, boundary);
  if (session.kind !== 'ready') throw new Error('Session must open');
  await session.record({ kind: 'start', server });
  return { database, session };
}

/** A server whose answer waits until the test releases it, acknowledging the group it was sent. */
function heldServer() {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  const send: Send = async (request) => {
    await held;
    return { status: 200, body: { revision: request.events.at(-1)!.seq } };
  };
  return { send, release };
}

test('a database waits to close until the upload using it finishes, so a reopen mid-upload loses no acknowledgment', async () => {
  const { database, session } = await liveGame();
  const server = heldServer();
  const runner = createUploadRunner(server.send);
  const run = runner.run(session);
  let closed = false;
  const closing = runner.idle().then(async () => {
    closed = true;
    await database.close();
  });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(closed, false, 'the reopen waits for the answer');
  server.release();
  assert.deepEqual((await run)?.status, { kind: 'synced' });
  await closing;
  assert.equal(closed, true);
});

test('a run already going for a game runs once more after it, so a play saved meanwhile still uploads', async () => {
  const { session } = await liveGame();
  const server = heldServer();
  const runner = createUploadRunner(server.send);
  const first = runner.run(session);
  await session.record({ kind: 'pitch', result: 'ball' });
  const second = runner.run(session);
  server.release();
  await first;
  assert.deepEqual((await second)?.status, { kind: 'synced' });
  assert.equal(await session.nextUpload(), null, 'the ball saved during the first run uploaded too');
});

test('an upload slower than half a second says so, and stops saying so when it ends', async () => {
  const { session } = await liveGame();
  const server = heldServer();
  const runner = createUploadRunner(server.send, 30);
  const slow: boolean[] = [];
  const run = runner.run(session, (value) => slow.push(value));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.deepEqual(slow, [true]);
  server.release();
  await run;
  assert.deepEqual(slow, [true, false]);
  const quick = createUploadRunner(async (request) => ({ status: 200, body: { revision: request.events.at(-1)!.seq } }), 30);
  const quickSlow: boolean[] = [];
  await session.record({ kind: 'pitch', result: 'ball' });
  await quick.run(session, (value) => quickSlow.push(value));
  assert.deepEqual(quickSlow, [false], 'a quick upload never shows as slow');
});
