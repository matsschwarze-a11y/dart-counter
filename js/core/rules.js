// X01-Regeln: Punkte, Double-in, Bust, Checkout. Rein, ohne Zustand.
import { dartPoints } from './board.js';

export const OUT_MODES = Object.freeze(['double', 'master', 'straight']);

/** Darf dieser Dart ein Leg beenden? */
export function isValidFinish(d, outMode) {
  if (d.seg === 0) return false;
  if (outMode === 'straight') return true;
  if (outMode === 'master') return d.mult >= 2;
  return d.mult === 2; // double (inkl. Bull)
}

/** Kleinster erlaubter Rest ungleich 0 (Rest 1 ist bei Double/Master-out nicht checkbar). */
export function isDeadRest(rest, outMode) {
  return rest === 1 && outMode !== 'straight';
}

/** Kann `rest` mit genau einem gültigen Finish-Dart beendet werden? (= Doppelversuch) */
export function canFinishWithOneDart(rest, outMode) {
  if (rest === 50) return true;
  const dbl = rest >= 2 && rest <= 40 && rest % 2 === 0;
  if (outMode === 'double') return dbl;
  const tpl = rest >= 3 && rest <= 60 && rest % 3 === 0;
  if (outMode === 'master') return dbl || tpl;
  return (rest >= 1 && rest <= 20) || rest === 25 || dbl || tpl;
}

/**
 * Wendet einen Dart an.
 * @param {{rest:number, opened:boolean}} state  Rest vor dem Dart, ob Double-in schon erfüllt
 * @param {{seg:number, mult:number}} d
 * @param {{outMode:string, doubleIn:boolean}} settings
 * @returns {{points:number, rest:number, opened:boolean, bust:boolean, checkout:boolean, doubleAttempt:boolean}}
 *   `rest` ist der Rest nach dem Dart (bei Bust: unverändert, die Aufnahme wird vom Aufrufer zurückgesetzt).
 */
export function applyDart(state, d, settings) {
  const { outMode = 'double', doubleIn = false } = settings;
  const doubleAttempt = state.opened || !doubleIn ? canFinishWithOneDart(state.rest, outMode) : false;
  let opened = state.opened || !doubleIn;
  let points = dartPoints(d);
  if (!opened) {
    if (d.mult === 2 && d.seg !== 0) opened = true;
    else points = 0;
  }
  const after = state.rest - points;
  let bust = false;
  let checkout = false;
  if (after < 0 || isDeadRest(after, outMode)) bust = true;
  else if (after === 0) {
    if (isValidFinish(d, outMode)) checkout = true;
    else bust = true;
  }
  return {
    points: bust ? 0 : points,
    rest: bust ? state.rest : after,
    opened,
    bust,
    checkout,
    doubleAttempt,
  };
}

/** Liegt der Rest überhaupt im Checkout-Bereich (max. 170 bei Double-out)? */
export function maxCheckout(outMode, darts = 3) {
  if (outMode === 'straight' || outMode === 'master') return 180 - (3 - darts) * 60;
  return [0, 50, 110, 170][darts];
}
