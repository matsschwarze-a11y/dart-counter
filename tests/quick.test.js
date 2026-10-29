import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleChips } from '../js/core/quick.js';

const S = { outMode: 'double', doubleIn: false };
const scores = (rest, settings = S, thrown = 0) => visibleChips(rest, true, settings, thrown).map((c) => c.score);

test('alle Chips bei 501', () => {
  assert.deepEqual(scores(501), [0, 26, 41, 45, 60, 81, 85, 100, 140, 180]);
});

test('keine Chips, die bustern oder auf Single checken', () => {
  assert.deepEqual(scores(100), [0, 26, 41, 45, 60, 81, 85]); // 100 wäre S20 auf 0 → Bust
  assert.deepEqual(scores(61), [0, 26, 41, 45]); // 60 → Rest 1 = Bust
  assert.deepEqual(scores(27), [0]); // 26 → Rest 1
});

test('Straight-out: Chip, der genau checkt, wird ausgeblendet (Aufnahme endet vorher)', () => {
  assert.ok(!scores(60, { outMode: 'straight' }).includes(60));
});

test('nach dem ersten Dart keine Chips', () => {
  assert.deepEqual(scores(501, S, 1), []);
});
