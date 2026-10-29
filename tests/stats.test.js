import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playerStats, headToHead, averageHistory, doubleTable, filterMatches } from '../js/stats/stats.js';
import { dartsCsv, matchesCsv, BOM } from '../js/stats/csv.js';
import { makeMatch, play } from './helpers.js';

function fixture() {
  // 101, first to 1 Leg. A: T20 S20 S1 = 81 → Rest 20 | B: 0 0 0 | A: S10 (Rest 10), D4 (Rest 2), D1 → Checkout
  const m = play(makeMatch({ startScore: 101, format: { type: 'firstTo', legs: 1 } }), 'T20 S20 S1  0 0 0  S10 D4 D1');
  return m;
}

test('Fixture-Match: Average, Checkout-Quote, bestes Finish, bestes Leg', () => {
  const m = fixture();
  assert.equal(m.status, 'finished');
  assert.equal(m.winnerIndex, 0);
  const s = playerStats([m], 'p0');
  assert.equal(s.darts, 6);
  assert.equal(s.points, 101);
  assert.equal(s.average, 101 / 2);
  // Doppelversuche: S10 bei Rest 20, D4 bei Rest 10, D1 bei Rest 2
  assert.equal(s.attempts, 3);
  assert.equal(s.checkouts, 1);
  assert.equal(s.bestFinish, 20);
  assert.equal(s.bestLeg, 6);
  assert.equal(s.matchWinRate, 1);
  assert.equal(s.c60, 1);
  const dt = doubleTable(s);
  assert.deepEqual(dt.find((d) => d.field === 'D1'), { field: 'D1', attempts: 1, hits: 1, rate: 1 });
  assert.deepEqual(dt.find((d) => d.field === 'D10'), { field: 'D10', attempts: 1, hits: 0, rate: 0 });
  const b = playerStats([m], 'p1');
  assert.equal(b.average, 0);
  assert.equal(b.matchWinRate, 0);
});

test('First-9 zählt nur die ersten drei Aufnahmen je Leg', () => {
  const m = play(makeMatch({}, ['A']), 'T20 T20 T20  S1 S1 S1  S1 S1 S1  S1 S1 S1');
  m.status = 'finished';
  const s = playerStats([m], 'p0');
  assert.equal(s.first9, (186 / 9) * 3);
  assert.equal(s.average, (189 / 12) * 3);
});

test('Filter, Head-to-Head und Verlauf', () => {
  const m = fixture();
  const running = makeMatch();
  assert.equal(filterMatches([m, running], 'p0').length, 1);
  assert.equal(filterMatches([m], 'p0', { startScore: 501 }).length, 0);
  assert.equal(filterMatches([m], 'p0', { opponent: 'p1' }).length, 1);
  assert.equal(filterMatches([m], 'p0', { opponent: 'bot:60' }).length, 0);
  const h = headToHead([m], 'p0', 'p1');
  assert.equal(h.matches, 1);
  assert.equal(h.a.matchesWon, 1);
  assert.equal(h.b.matchesWon, 0);
  assert.equal(averageHistory([m], 'p0').length, 1);
});

test('CSV: BOM, Semikolon, Dezimalkomma', () => {
  const m = fixture();
  const d = dartsCsv([m]);
  assert.ok(d.startsWith(BOM));
  const lines = d.slice(1).trim().split('\r\n');
  assert.equal(lines.length, 1 + 9);
  assert.ok(lines[0].startsWith('Match-ID;Datum;Spieler'));
  assert.ok(lines[1].includes(';T20;20;3;60;101;'));
  const mc = matchesCsv([m]);
  assert.ok(mc.includes('50,50 / 0,00'));
  assert.ok(mc.includes('A / B'));
});
