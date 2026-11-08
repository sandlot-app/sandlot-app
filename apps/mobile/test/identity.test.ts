import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveToken, type AuthPort } from '../src/sync/identity.ts';

type Answer = { session: { access_token: string; user: { id: string } } | null; error: { retryable: boolean } | null };
const signedIn = (user: string): Answer => ({ session: { access_token: `token-${user}`, user: { id: user } }, error: null });
const none: Answer = { session: null, error: null };

function phone(answers: { get?: Answer; refresh?: Answer; anonymous?: Answer }, remembered: string | null = null) {
  const calls: string[] = [];
  const memory = new Map<string, string>(remembered ? [['sandlot.phone-user', remembered]] : []);
  const auth: AuthPort = {
    getSession: async () => { calls.push('get'); return answers.get ?? none; },
    refreshSession: async () => { calls.push('refresh'); return answers.refresh ?? none; },
    signInAnonymously: async () => { calls.push('anonymous'); return answers.anonymous ?? none; },
    retryable: (error) => (error as { retryable: boolean }).retryable,
  };
  const storage = { getItem: async (key: string) => memory.get(key) ?? null, setItem: async (key: string, value: string) => { memory.set(key, value); } };
  return { auth, storage, calls, memory };
}

test('a first launch signs in anonymously and remembers who this phone is', async () => {
  const p = phone({ anonymous: signedIn('scorer') });
  assert.deepEqual(await resolveToken(p.auth, p.storage, false), { token: 'token-scorer' });
  assert.equal(p.memory.get('sandlot.phone-user'), 'scorer');
});

test('a phone that has signed in before keeps its identity when a refresh fails, and is signed out instead', async () => {
  const p = phone({ refresh: { session: null, error: { retryable: false } }, anonymous: signedIn('stranger') }, 'scorer');
  assert.deepEqual(await resolveToken(p.auth, p.storage, true), { failure: 'signed_out' });
  assert.deepEqual(p.calls, ['refresh'], 'no new anonymous user is made');
  const lost = phone({ get: none, anonymous: signedIn('stranger') }, 'scorer');
  assert.deepEqual(await resolveToken(lost.auth, lost.storage, false), { failure: 'signed_out' }, 'a session the library dropped is not replaced either');
  assert.deepEqual(lost.calls, ['get']);
});

test('a refresh with no answer is offline, not signed out', async () => {
  const p = phone({ refresh: { session: null, error: { retryable: true } } }, 'scorer');
  assert.deepEqual(await resolveToken(p.auth, p.storage, true), { failure: 'offline' });
});

test('a working session gives its token and refreshes when asked', async () => {
  const p = phone({ get: signedIn('scorer'), refresh: signedIn('scorer') }, 'scorer');
  assert.deepEqual(await resolveToken(p.auth, p.storage, false), { token: 'token-scorer' });
  assert.deepEqual(await resolveToken(p.auth, p.storage, true), { token: 'token-scorer' });
  assert.deepEqual(p.calls, ['get', 'refresh']);
});
