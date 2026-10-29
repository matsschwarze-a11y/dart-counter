import { test } from 'node:test';
import assert from 'node:assert/strict';
import { throwPattern, scatterTendency } from '../js/stats/stats.js';
import { makeMatch, play } from './helpers.js';

// 301, first to 1. Spieler A (B wirft immer daneben):
// T20 S5 S1 (Rest 235) · T19 S7 D20 (131) · S20 T5 S3 (93) · T19 D18 (Checkout)
function fixture() {
  return play(makeMatch({ startScore: 301, format: { type: 'firstTo', legs: 1 } }),
    'T20 S5 S1  0 0 0  T19 S7 D20  0 0 0  S20 T5 S3  0 0 0  T19 D18');
}

test('Wurfbild: Felder je Dart-Position', () => {
  const m = fixture();
  assert.equal(m.status, 'finished');
  const all = throwPattern([m], 'p0');
  assert.equal(all.total, 11);
  assert.equal(all.counts['19|3'], 2);
  assert.deepEqual(throwPattern([m], 'p0', {}, 1).counts, { '20|3': 1, '19|3': 2, '20|1': 1 });
  assert.deepEqual(throwPattern([m], 'p0', {}, 3).counts, { '1|1': 1, '20|2': 1, '3|1': 1 });
  assert.equal(throwPattern([m], 'p1').total, 9);
});

test('Streutendenz: nur Darts bei Rest ab 100, links/rechts und Triple/Single/Double', () => {
  const st = scatterTendency([fixture()], 'p0');
  assert.equal(st.scoring, 8); // S3 bei Rest 96 und die Checkout-Aufnahme zählen nicht
  assert.equal(st.outside, 0);
  const g20 = st.groups[20]; // T20 S5 S1 D20 S20 T5
  assert.deepEqual([g20.n, g20.left, g20.center, g20.right], [6, 2, 3, 1]);
  assert.deepEqual([g20.triple, g20.single, g20.double], [2, 3, 1]);
  assert.deepEqual(g20.byDart[0], { n: 2, triple: 1 });
  const g19 = st.groups[19]; // T19 S7
  assert.deepEqual([g19.n, g19.left, g19.center, g19.right, g19.triple], [2, 1, 1, 0, 1]);
});
