import assert from 'node:assert/strict';
import { test } from 'node:test';
import { belowBarSpace } from '../src/components/bottom-space.ts';

test('the Scorer Bar keeps the Figma bottom on iOS and clears Android navigation bars', () => {
  assert.equal(belowBarSpace('ios', 34), 0, 'the home indicator sits over the bar padding, as in Figma');
  assert.equal(belowBarSpace('ios', 0), 0);
  assert.equal(belowBarSpace('web', 0), 0);
  assert.equal(belowBarSpace('android', 48), 48, 'three-button navigation');
  assert.equal(belowBarSpace('android', 24), 24, 'gesture navigation');
});
