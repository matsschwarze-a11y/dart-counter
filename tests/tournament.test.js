import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../js/core/rng.js';
import { botAverages, createTournament, myPendingGame, recordMyResult, myPlacement, ROUND_LEGS, TOURNAMENT_SETTINGS } from '../js/core/tournament.js';
import { simulateBotMatch } from '../js/bot/sim-match.js';

const fakeSim = (a, b) => (a.average >= b.average ? { winner: 'a', legs: [3, 1], averages: [50, 45] } : { winner: 'b', legs: [1, 3], averages: [45, 50] });

test('Bot-Averages liegen realistisch um den eigenen Average', () => {
  for (const my of [30, 50, 75, 95]) {
    for (let seed = 1; seed <= 20; seed++) {
      const avgs = botAverages(my, mulberry32(seed));
      assert.equal(avgs.length, 7);
      const sd = Math.max(3, my * 0.1);
      for (const a of avgs) {
        assert.ok(a >= Math.max(25, my - 2 * sd) - 0.5 && a <= Math.min(100, my + 2 * sd) + 0.5, `${my}: ${a}`);
      }
      const mean = avgs.reduce((s, a) => s + a, 0) / avgs.length;
      assert.ok(Math.abs(mean - Math.min(Math.max(my, 28), 97)) < sd, `Mittel ${mean} bei ${my}`);
    }
  }
});

test('Turnier: Setzliste, Ablauf und Aufdecken', () => {
  const t = createTournament({ me: { playerId: 'p1', name: 'Ich' }, myAverage: 50, rand: mulberry32(3), id: 't1', now: 1 });
  assert.equal(t.entrants.length, 8);
  assert.equal(t.rounds[0].length, 4);
  assert.equal(new Set(t.rounds[0].flatMap((g) => [g.a, g.b])).size, 8);
  assert.ok(t.entrants.filter((e) => e.isBot).every((e) => !e.revealed));
  // Viertelfinale gewinnen
  let pg = myPendingGame(t);
  assert.equal(pg.round, 0);
  recordMyResult(t, pg, { won: true, legs: [3, 2], averages: [52, 48], matchId: 'm1' }, fakeSim, 2);
  const opp = pg.g.a === 'me' ? pg.g.b : pg.g.a;
  assert.ok(t.entrants.find((e) => e.id === opp).revealed);
  assert.equal(t.rounds.length, 2);
  assert.ok(t.rounds[0].every((g) => g.winner));
  // Halbfinale verlieren → Rest wird durchsimuliert, alle Bots aufgedeckt
  pg = myPendingGame(t);
  assert.equal(pg.round, 1);
  recordMyResult(t, pg, { won: false, legs: [1, 3], averages: [44, 55], matchId: 'm2' }, fakeSim, 3);
  assert.equal(t.status, 'finished');
  assert.equal(t.rounds.length, 3);
  assert.ok(t.rounds[2][0].winner);
  assert.ok(t.entrants.every((e) => !e.isBot || e.revealed));
  assert.equal(myPlacement(t), 'Aus im Halbfinale');
  assert.equal(myPendingGame(t), null);
});

test('Turniersieg', () => {
  const t = createTournament({ me: { playerId: 'p1', name: 'Ich' }, myAverage: 60, rand: mulberry32(9) });
  for (let r = 0; r < 3; r++) recordMyResult(t, myPendingGame(t), { won: true, legs: [ROUND_LEGS[r], 0], averages: [60, 50], matchId: 'm' + r }, fakeSim);
  assert.equal(t.status, 'finished');
  assert.equal(myPlacement(t), 'Turniersieg');
});

test('Bot-gegen-Bot-Match wird komplett gespielt', () => {
  const r = simulateBotMatch({ name: 'A', botAverage: 60 }, { name: 'B', botAverage: 45 }, 3, TOURNAMENT_SETTINGS, mulberry32(4));
  assert.ok(['a', 'b'].includes(r.winner));
  assert.equal(Math.max(...r.legs), 3);
  assert.ok(r.averages.every((a) => a > 20 && a < 110));
});
