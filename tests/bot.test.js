import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateMany, simulateLeg } from '../js/bot/simulate.js';
import { sigmaForAverage, CALIBRATION } from '../js/bot/calibration-table.js';
import { chooseTarget, leaveQuality } from '../js/bot/strategy.js';
import { mulberry32 } from '../js/core/rng.js';
import { dartLabel } from '../js/core/board.js';

const TARGETS = [30, 50, 70, 90];
const results = {};

for (const [i, target] of TARGETS.entries()) {
  test(`Kalibrierung: Ziel-Average ${target} über 1.000 Legs ±2`, () => {
    const r = simulateMany(sigmaForAverage(target), 1000, { seed: 4242 + i });
    results[target] = r;
    assert.ok(Math.abs(r.average - target) <= 2, `Ziel ${target}, erreicht ${r.average.toFixed(2)}`);
  });
}

test('Checkout-Quote steigt mit der Stärke', () => {
  const rates = TARGETS.map((t) => results[t]?.checkoutRate ?? simulateMany(sigmaForAverage(t), 1000, { seed: 7 }).checkoutRate);
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] > rates[i - 1], `Quoten: ${rates.map((x) => x.toFixed(3))}`);
});

test('Kalibrierungstabelle ist monoton und deckt 25–100 ab', () => {
  for (let i = 1; i < CALIBRATION.length; i++) {
    assert.ok(CALIBRATION[i][0] <= CALIBRATION[i - 1][0]);
    assert.ok(CALIBRATION[i][1] > CALIBRATION[i - 1][1]);
  }
  assert.ok(CALIBRATION[0][0] >= 100);
  assert.ok(CALIBRATION[CALIBRATION.length - 1][0] <= 25);
});

test('Zielwahl: Checkout folgt der Tabelle, Stellen vermeidet Bust und Bogey', () => {
  const base = { opened: true, settings: { outMode: 'double' }, sigma: 12, visit: { scoringNumber: 20 }, rand: () => 0.5 };
  assert.equal(dartLabel(chooseTarget({ ...base, rest: 170, dartsLeft: 3, visitStart: 170 })), 'T20');
  assert.equal(dartLabel(chooseTarget({ ...base, rest: 40, dartsLeft: 1, visitStart: 100 })), 'D20');
  assert.equal(dartLabel(chooseTarget({ ...base, rest: 501, dartsLeft: 3, visitStart: 501 })), 'T20');
  // Über 170 wird normal gepunktet
  assert.equal(dartLabel(chooseTarget({ ...base, rest: 180, dartsLeft: 1, visitStart: 300 })), 'T20');
  // Letzter Dart bei 62 (nicht checkbar): Ziel lässt einen guten Rest (kein Bust, nicht ungerade über 40)
  const t = chooseTarget({ ...base, rest: 62, dartsLeft: 1, visitStart: 62 });
  assert.ok(leaveQuality(62 - t.seg * t.mult) >= 80, dartLabel(t));
  assert.ok(leaveQuality(32) > leaveQuality(33));
  assert.ok(leaveQuality(159) < leaveQuality(160));
});

test('Simuliertes Leg endet mit gültigem Checkout', () => {
  const leg = simulateLeg(sigmaForAverage(60), {}, mulberry32(3));
  const last = leg.visits[leg.visits.length - 1];
  assert.ok(last.checkout);
  assert.equal(last.darts[last.darts.length - 1].mult, 2);
  assert.equal(leg.visits.reduce((s, v) => s + v.score, 0), 501);
});
