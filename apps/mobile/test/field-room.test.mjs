import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tokens } from '@sandlot/tokens';
import { batterSpot, chipLook, fielderSpots, fieldWidth, roomBelowField, runnerSpots } from '../src/components/field-room.ts';

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

test('chips shrink with the field until their names would drop below 10 points', () => {
  assert.deepEqual(chipLook(361), { style: null, names: true }, 'Figma size draws the chips as designed');
  assert.deepEqual(chipLook(398), { style: null, names: true }, 'a wider field never grows them');
  assert.deepEqual(chipLook(340), { style: { transform: [{ scale: 340 / 361 }], transformOrigin: '50% 0%' }, names: true });
  for (let width = 200; width <= 361; width++) {
    const look = chipLook(width);
    const scale = look.style?.transform[0].scale ?? 1;
    if (look.names) assert.ok(11 * scale >= 10, `names are ${11 * scale} points at a ${width}-point field`);
    assert.ok(scale >= 10 / 11, `chips never shrink past the floor at a ${width}-point field`);
  }
});

test('on an iPhone SE the chips stop at the floor and drop their names, and no two discs touch', () => {
  const width = 236;
  const look = chipLook(width);
  assert.deepEqual(look, { style: { transform: [{ scale: 10 / 11 }], transformOrigin: '50% 0%' }, names: false });
  const field = width / 361;
  const chip = look.style.transform[0].scale;
  const discs = [
    ...Object.values(fielderSpots).map((spot) => ({ spot, size: tokens.modes.Light.sizes['chip/size'] })),
    ...Object.values(runnerSpots).map((spot) => ({ spot, size: tokens.modes.Light.sizes['chip/size'] })),
    { spot: batterSpot, size: tokens.modes.Light.sizes['chip/batter-size'] },
  ].map(({ spot, size }) => ({ x: spot.x * field, y: spot.y * field + size * chip / 2, r: size * chip / 2 }));
  for (const [i, a] of discs.entries()) for (const b of discs.slice(i + 1)) {
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > a.r + b.r, `discs at ${JSON.stringify(a)} and ${JSON.stringify(b)} overlap`);
  }
});
