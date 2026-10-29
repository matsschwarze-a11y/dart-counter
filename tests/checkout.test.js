import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHECKOUT_TABLE } from '../js/core/checkout-table.js';
import { getCheckout, computeCheckout } from '../js/core/checkout.js';
import { parseDart, dartPoints } from '../js/core/board.js';
import { isValidFinish } from '../js/core/rules.js';

const BOGEY = [169, 168, 166, 165, 163, 162, 159];

function assertValidRoute(route, rest, darts, outMode) {
  assert.ok(route.length <= darts, `${rest}: ${route} zu lang`);
  const ds = route.map(parseDart);
  assert.equal(ds.reduce((s, d) => s + dartPoints(d), 0), rest, `${rest}: ${route} ergibt nicht den Rest`);
  assert.ok(isValidFinish(ds[ds.length - 1], outMode), `${rest}: ${route} endet ungültig`);
  let r = rest;
  for (const d of ds.slice(0, -1)) {
    r -= dartPoints(d);
    assert.ok(r >= 2 || (outMode === 'straight' && r >= 1), `${rest}: ${route} Zwischenrest ${r}`);
  }
}

test('Tabelle: jeder Weg ergibt exakt den Rest und endet auf Doppel', () => {
  for (const darts of [1, 2, 3]) {
    for (const [rest, route] of Object.entries(CHECKOUT_TABLE[darts])) assertValidRoute(route, Number(rest), darts, 'double');
  }
});

test('Tabelle: genau die Bogey-Zahlen haben keinen 3-Dart-Weg', () => {
  const missing = [];
  for (let r = 2; r <= 170; r++) if (!CHECKOUT_TABLE[3][r]) missing.push(r);
  assert.deepEqual(missing.sort((a, b) => b - a), BOGEY);
  assert.equal(getCheckout(171, 3), null);
  assert.equal(getCheckout(1, 3), null);
});

test('Tabelle: 2 und 1 Dart', () => {
  assert.equal(CHECKOUT_TABLE[2][110].join(' '), 'T20 BULL');
  assert.equal(getCheckout(111, 2), null);
  assert.equal(getCheckout(41, 1), null);
  assert.deepEqual(getCheckout(40, 1), ['D20']);
  assert.deepEqual(getCheckout(50, 1), ['BULL']);
  for (let r = 2; r <= 50; r++) {
    const expected = r === 50 || (r <= 40 && r % 2 === 0);
    assert.equal(!!CHECKOUT_TABLE[1][r], expected, `1 Dart, Rest ${r}`);
  }
});

test('Profi-Wege', () => {
  assert.deepEqual(getCheckout(170, 3), ['T20', 'T20', 'BULL']);
  assert.deepEqual(getCheckout(100, 3), ['T20', 'D20']);
  assert.deepEqual(getCheckout(32, 3), ['D16']);
  assert.deepEqual(getCheckout(61, 2), ['T15', 'D8']);
});

test('Master-out und Straight-out', () => {
  for (const mode of ['master', 'straight']) {
    for (const darts of [1, 2, 3]) {
      for (let rest = 2; rest <= 180; rest++) {
        const route = computeCheckout(rest, darts, mode);
        if (route) assertValidRoute(route, rest, darts, mode);
      }
    }
  }
  assert.deepEqual(computeCheckout(60, 1, 'master'), ['T20']);
  assert.deepEqual(computeCheckout(180, 3, 'master'), ['T20', 'T20', 'T20']);
  assert.deepEqual(computeCheckout(1, 1, 'straight'), ['S1']);
});
