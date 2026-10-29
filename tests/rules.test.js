import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyDart, canFinishWithOneDart } from '../js/core/rules.js';
import { parseDart as P } from '../js/core/board.js';

const S = (outMode = 'double', doubleIn = false) => ({ outMode, doubleIn });
const st = (rest, opened = true) => ({ rest, opened });

test('Double-out: Checkout nur mit Doppel/Bull', () => {
  assert.equal(applyDart(st(40), P('D20'), S()).checkout, true);
  assert.equal(applyDart(st(50), P('BULL'), S()).checkout, true);
  const r = applyDart(st(20), P('S20'), S());
  assert.equal(r.bust, true);
  assert.equal(r.rest, 20);
  assert.equal(r.points, 0);
});

test('Double-out: Bust bei Rest < 0 und Rest 1', () => {
  assert.equal(applyDart(st(30), P('T20'), S()).bust, true);
  assert.equal(applyDart(st(21), P('S20'), S()).bust, true);
  assert.equal(applyDart(st(22), P('S20'), S()).bust, false);
});

test('Master-out: Triple beendet, Rest 1 bleibt Bust', () => {
  assert.equal(applyDart(st(60), P('T20'), S('master')).checkout, true);
  assert.equal(applyDart(st(40), P('D20'), S('master')).checkout, true);
  assert.equal(applyDart(st(20), P('S20'), S('master')).bust, true);
  assert.equal(applyDart(st(21), P('S20'), S('master')).bust, true);
});

test('Straight-out: jedes Feld beendet, Rest 1 erlaubt', () => {
  assert.equal(applyDart(st(20), P('S20'), S('straight')).checkout, true);
  assert.equal(applyDart(st(21), P('S20'), S('straight')).bust, false);
  assert.equal(applyDart(st(10), P('S20'), S('straight')).bust, true);
});

test('Double-in: Punkte erst ab erstem Doppel', () => {
  let r = applyDart(st(501, false), P('T20'), S('double', true));
  assert.equal(r.points, 0);
  assert.equal(r.opened, false);
  r = applyDart(st(501, false), P('D20'), S('double', true));
  assert.equal(r.points, 40);
  assert.equal(r.opened, true);
  r = applyDart(st(501, false), P('BULL'), S('double', true));
  assert.equal(r.points, 50);
});

test('Doppelversuch-Erkennung', () => {
  assert.equal(canFinishWithOneDart(40, 'double'), true);
  assert.equal(canFinishWithOneDart(50, 'double'), true);
  assert.equal(canFinishWithOneDart(41, 'double'), false);
  assert.equal(canFinishWithOneDart(42, 'double'), false);
  assert.equal(canFinishWithOneDart(57, 'master'), true);
  assert.equal(canFinishWithOneDart(17, 'straight'), true);
  assert.equal(applyDart(st(32), P('S16'), S()).doubleAttempt, true);
  assert.equal(applyDart(st(33), P('S1'), S()).doubleAttempt, false);
});
