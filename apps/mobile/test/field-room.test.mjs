import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chipScale, fieldWidth, roomBelowField } from '../src/components/field-room.ts';

test('the field keeps the Figma 361 × 390 shape and stops 12 points above whatever sits below it', () => {
  assert.equal(fieldWidth({ width: 0, height: 0 }, 0), null, 'nothing to fit before the room is measured');
  assert.deepEqual(fieldWidth({ width: 343, height: 500 }, 200), { width: (500 - 200 - 12) * 361 / 390 });
  assert.deepEqual(fieldWidth({ width: 343, height: 900 }, 200), { width: 343 }, 'never wider than the room');
  assert.deepEqual(fieldWidth({ width: 343, height: 100 }, 200), { width: 0 });
});

test('a saved game that will not open moves the field up above its error card instead of sitting under it', () => {
  assert.equal(roomBelowField({ blocked: false, bar: 203, dock: 330 }), 203, 'brief messages still sit over the field for a moment');
  assert.equal(roomBelowField({ blocked: true, bar: 203, dock: 330 }), 330);
});

test('on a field smaller than Figma the chips shrink with it, pinned at the top of each disc spot', () => {
  const se = 236 / 361;
  assert.deepEqual(chipScale(236), { transform: [{ scale: se }], transformOrigin: '50% 0%' }, 'an iPhone SE field shrinks every chip the same, names included');
  assert.equal(chipScale(361), null, 'Figma size draws the chips as designed');
  assert.equal(chipScale(398), null, 'a wider field never grows them');
});
