import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentState, undo, editVisit, playerTotals, winsNeeded } from '../js/core/match.js';
import { makeMatch, play, D } from './helpers.js';

test('Spielerwechsel nach 3 Darts, Rest wird abgezogen', () => {
  const m = play(makeMatch(), 'T20 T20 T20 S1 S1');
  const s = currentState(m);
  assert.deepEqual(s.rests, [321, 499]);
  assert.equal(s.player, 1);
  assert.equal(s.dartsLeft, 1);
});

test('Bust setzt Rest auf Aufnahmebeginn zurück und beendet die Aufnahme sofort', () => {
  const m = play(makeMatch({ startScore: 301 }), "T20 T20 T20  0 0 0  T20 T20");
  // A: 121 → T20 (61) → T20 (1) = Bust, Rest wieder 121
  let s = currentState(m);
  assert.deepEqual(s.rests, [121, 301]);
  const m2 = play(makeMatch({ startScore: 101 }), 'T20 T20');
  s = currentState(m2);
  assert.deepEqual(s.rests, [101, 101]);
  assert.equal(s.player, 1, 'nach Bust ist der nächste Spieler dran');
  const v = m2.legs[0].visits[0];
  assert.equal(v.bust, true);
  assert.equal(v.score, 0);
  assert.equal(v.darts.length, 2);
});

test('Rest 1 bei Double-out ist Bust, Single auf 0 ist Bust', () => {
  let m = play(makeMatch({ startScore: 21 }), 'S20');
  assert.equal(m.legs[0].visits[0].bust, true);
  m = play(makeMatch({ startScore: 20 }), 'S20');
  assert.equal(m.legs[0].visits[0].bust, true);
  assert.equal(currentState(m).rests[0], 20);
});

test('Checkout vor dem 3. Dart: nur gezählte Darts, Leg gewonnen, Anwurf wechselt', () => {
  const m = play(makeMatch({ startScore: 40, format: { type: 'firstTo', legs: 2 } }), 'S20 D10');
  assert.equal(m.legs[0].winnerIndex, 0);
  assert.equal(m.legs[0].visits[0].darts.length, 2);
  const s = currentState(m);
  assert.equal(s.legIndex, 1);
  assert.equal(s.player, 1, 'B wirft das zweite Leg an');
  assert.deepEqual(s.rests, [40, 40]);
  assert.deepEqual(playerTotals(m.legs, 0), { points: 40, darts: 2, average: 60 });
});

test('Match-Ende first to / best of / Sets', () => {
  assert.equal(winsNeeded('bestOf', 5), 3);
  assert.equal(winsNeeded('firstTo', 3), 3);
  const m = play(makeMatch({ startScore: 40, format: { type: 'bestOf', legs: 3 } }), 'D20  D20  0 0 0  D20');
  // Leg1: A gewinnt. Leg2: B startet, B gewinnt. Leg3: A startet, A wirft 0 0 0, B checkt.
  assert.equal(m.status, 'finished');
  assert.equal(m.winnerIndex, 1);
  const ms = play(makeMatch({ startScore: 40, format: { type: 'firstTo', legs: 2, sets: 2 } }), 'D20 0 0 0 D20 D20 0 0 0 D20');
  // Set1: A, (B startet) A? Leg2: B startet 0 0 0, A D20 → A gewinnt Set 1. Set2 Leg1: B startet D20. Leg2: A startet 0 0 0, B D20 → Set 2 an B.
  assert.equal(ms.status, 'running');
  const s = currentState(ms);
  assert.deepEqual(s.setsWon, [1, 1]);
});

test('Double-in: Darts vor dem Doppel zählen 0', () => {
  const m = play(makeMatch({ doubleIn: true }), 'T20 D20 T20');
  assert.equal(m.legs[0].visits[0].score, 100);
  assert.equal(currentState(m).rests[0], 401);
});

test('Undo über Spielerwechsel und Leg-Ende hinweg', () => {
  const m = play(makeMatch({ startScore: 40, format: { type: 'firstTo', legs: 2 } }), 'S10 S10 0  D20');
  assert.equal(currentState(m).legIndex, 1);
  undo(m);
  let s = currentState(m);
  assert.equal(s.legIndex, 0);
  assert.equal(s.player, 1);
  undo(m);
  s = currentState(m);
  assert.equal(s.player, 0);
  assert.equal(s.dartsLeft, 1);
  assert.deepEqual(s.visitDarts.map((d) => d.seg), [10, 10]);
});

test('Undo nach Match-Ende öffnet das Match wieder', () => {
  const m = play(makeMatch({ startScore: 40, format: { type: 'firstTo', legs: 1 } }), 'D20');
  assert.equal(m.status, 'finished');
  undo(m);
  assert.equal(m.status, 'running');
  assert.equal(m.finishedAt, null);
});

test('Aufnahme bearbeiten: Folgeaufnahmen werden neu berechnet', () => {
  const m = play(makeMatch(), 'T20 T20 T20  S20 S20 S20  S1 S1 S1');
  const r = editVisit(m, 0, 0, D('T20 S20 S20'));
  assert.equal(r.dropped, 0);
  const s = currentState(m);
  assert.deepEqual(s.rests, [501 - 100 - 3, 501 - 60]);
  assert.equal(s.player, 1);
});

test('Aufnahme bearbeiten: früherer Checkout verwirft überzählige Aufnahmen', () => {
  const m = play(makeMatch({ startScore: 100, format: { type: 'firstTo', legs: 1 } }), 'S20 S20 S20  0 0 0  S20 D10');
  assert.equal(m.status, 'finished');
  assert.equal(m.legs[0].winnerIndex, 0);
  const r = editVisit(m, 0, 0, D('T20 D20'));
  assert.equal(r.dropped, 2);
  assert.equal(m.legs[0].winnerIndex, 0);
  assert.equal(m.legs[0].visits.length, 1);
  assert.equal(m.status, 'finished');
});

test('Gerade beendetes Leg bearbeiten: Checkout entfernen setzt das Leg fort', () => {
  const m = play(makeMatch({ startScore: 40, format: { type: 'firstTo', legs: 2 } }), 'D20');
  assert.equal(m.legs.length, 2);
  editVisit(m, 0, 0, D('S20 S10 0'));
  const s = currentState(m);
  assert.equal(m.legs.length, 1);
  assert.deepEqual(s.rests, [10, 40]);
  assert.equal(s.player, 1);
});

test('Aufnahme bearbeiten: wegfallender Bust füllt mit Fehlwürfen auf', () => {
  const m = play(makeMatch({ startScore: 30 }), 'T20  0 0 0');
  assert.equal(m.legs[0].visits[0].bust, true);
  const r = editVisit(m, 0, 0, D('S5'));
  assert.equal(r.padded, 2);
  const s = currentState(m);
  assert.deepEqual(s.rests, [25, 30]);
  assert.equal(s.player, 0);
});
