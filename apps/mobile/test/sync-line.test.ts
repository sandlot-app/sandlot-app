import assert from 'node:assert/strict';
import { test } from 'node:test';
import { syncLine } from '../src/sync/sync-line.ts';

const base = { live: true, waiting: 1, saving: false, upload: null, slow: false, lastPlay: 'Ball' } as const;

test('a play saving on the phone shows Saving whatever the upload is doing', () => {
  assert.deepEqual(syncLine({ ...base, saving: true, upload: { kind: 'stopped', reason: 'rejected' } }), { status: 'saving', lastPlay: 'Ball' });
});

test('the local demo never uploads, so its plays always read as saved on this phone', () => {
  assert.deepEqual(syncLine({ ...base, live: false, waiting: 4, upload: { kind: 'synced' } }), { status: 'offline', lastPlay: 'Ball', waiting: 4 });
});

test('a live game with nothing waiting is saved, even after a stop was cleared', () => {
  assert.deepEqual(syncLine({ ...base, waiting: 0, upload: { kind: 'stopped', reason: 'session' } }), { status: 'saved', lastPlay: 'Ball' });
});

test('a stopped queue says why and how many plays wait', () => {
  assert.deepEqual(syncLine({ ...base, waiting: 3, upload: { kind: 'stopped', reason: 'update_app' } }),
    { status: 'stopped', lastPlay: 'Ball', waiting: 3, reason: 'update the app' });
  assert.equal(syncLine({ ...base, upload: { kind: 'stopped', reason: 'signed_out' } }).status, 'stopped');
});

test('after a try with no answer, the line stays Offline through each retry, even a slow one', () => {
  assert.deepEqual(syncLine({ ...base, waiting: 2, upload: { kind: 'waiting' }, slow: true }), { status: 'offline', lastPlay: 'Ball', waiting: 2 });
});

test('Saving shows only for an upload slower than half a second; a quick one reads as saved (Figma 72:2925)', () => {
  assert.deepEqual(syncLine({ ...base, slow: true }), { status: 'saving', lastPlay: 'Ball' });
  assert.deepEqual(syncLine({ ...base, upload: { kind: 'synced' } }), { status: 'saved', lastPlay: 'Ball' });
  assert.deepEqual(syncLine(base), { status: 'saved', lastPlay: 'Ball' }, 'before the first try');
});
