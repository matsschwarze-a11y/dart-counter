import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pointToDart, aimPoint, dartLabel, parseDart, dartPoints, neighbours, RADII } from '../js/core/board.js';

test('Zielpunkte treffen das gewünschte Feld', () => {
  for (const n of [...Array(20).keys()].map((i) => i + 1)) {
    for (const mult of [1, 2, 3]) {
      const d = { seg: n, mult };
      const p = aimPoint(d);
      assert.deepEqual(pointToDart(p.x, p.y), d, dartLabel(d));
    }
  }
  assert.deepEqual(pointToDart(0, 0), { seg: 25, mult: 2 });
  const sb = aimPoint({ seg: 25, mult: 1 });
  assert.deepEqual(pointToDart(sb.x, sb.y), { seg: 25, mult: 1 });
});

test('Geometrie: Ränder und Ausrichtung', () => {
  assert.deepEqual(pointToDart(0, 100), { seg: 20, mult: 3 });
  assert.deepEqual(pointToDart(0, -100), { seg: 3, mult: 3 });
  assert.deepEqual(pointToDart(100, 0), { seg: 6, mult: 3 });
  assert.deepEqual(pointToDart(-100, 0), { seg: 11, mult: 3 });
  assert.deepEqual(pointToDart(0, RADII.doubleOuter + 0.1), { seg: 0, mult: 1 });
  assert.deepEqual(pointToDart(0, 165), { seg: 20, mult: 2 });
  // 20 liegt zwischen 5 (links) und 1 (rechts)
  assert.deepEqual(neighbours(20), [5, 1]);
  const a = (8.5 * Math.PI) / 180; // leicht rechts der Mitte, noch 20
  assert.equal(pointToDart(130 * Math.sin(a), 130 * Math.cos(a)).seg, 20);
  const b = (9.5 * Math.PI) / 180;
  assert.equal(pointToDart(130 * Math.sin(b), 130 * Math.cos(b)).seg, 1);
});

test('Notation hin und zurück', () => {
  for (const l of ['T20', 'D16', 'S5', '25', 'BULL', '0']) assert.equal(dartLabel(parseDart(l)), l);
  assert.equal(dartPoints(parseDart('BULL')), 50);
  assert.equal(dartPoints(parseDart('T19')), 57);
});
