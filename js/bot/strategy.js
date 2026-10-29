// Zielwahl wie ein Mensch: Scoring, Stellen, Checkout.
import { dartPoints } from '../core/board.js';
import { getCheckoutDarts } from '../core/checkout.js';
import { isDeadRest, isValidFinish } from '../core/rules.js';
import { outcomeDistribution } from './throw-model.js';

const T = (n) => ({ seg: n, mult: 3 });
const S = (n, area = 'big') => ({ seg: n, mult: 1, area });

// Kandidaten für den Stell-Dart (letzter Dart einer Aufnahme ohne Finish-Chance).
const SETUP_CANDIDATES = [
  ...[20, 19, 18, 17, 16, 15].map(T),
  ...[...Array(20).keys()].map((i) => S(i + 1)),
  { seg: 25, mult: 1 },
];

const LEAVE_BONUS = { 40: 10, 32: 12, 16: 8, 24: 6, 36: 6, 20: 6, 8: 5, 12: 4, 28: 3 };

/** Güte eines Rests für die nächste Aufnahme (3 Darts). */
export function leaveQuality(r, outMode = 'double') {
  if (r <= 0) return 0;
  if (outMode !== 'double') {
    if (getCheckoutDarts(r, 1, outMode)) return 100;
    if (getCheckoutDarts(r, 2, outMode)) return 75;
    if (getCheckoutDarts(r, 3, outMode)) return 40 - (r - 110) * 0.1;
    return Math.max(0, 5 - (r - 170) * 0.05);
  }
  if (r === 1) return 0;
  if ((r <= 40 && r % 2 === 0)) return 100 + (LEAVE_BONUS[r] || 0);
  if (r === 50) return 70;
  if (r < 40) return 85;
  if (r <= 60) return 80;
  if (getCheckoutDarts(r, 2, outMode)) return 60 - (r - 60) * 0.3;
  if (r <= 170 && getCheckoutDarts(r, 3, outMode)) return 35 - (r - 110) * 0.25;
  if (r <= 170) return 5;
  return Math.max(0, 4 - (r - 170) * 0.05);
}

/** Wahrscheinlichkeit, dass ein schwacher Bot breit (große Single-Fläche) statt aufs Triple zielt. */
export function wideAimProbability(sigma) {
  return Math.min(0.8, Math.max(0, (sigma - 30) / 50));
}

/**
 * Wählt das Ziel für den nächsten Dart.
 * @param {object} ctx
 * @param {number} ctx.rest          aktueller Rest
 * @param {number} ctx.dartsLeft     verbleibende Darts dieser Aufnahme (1–3)
 * @param {number} ctx.visitStart    Rest zu Beginn der Aufnahme
 * @param {boolean} ctx.opened       Double-in erfüllt
 * @param {object} ctx.settings      {outMode, doubleIn}
 * @param {number} ctx.sigma         aktuelle Streuung (mm)
 * @param {object} ctx.visit         Aufnahme-Zustand {scoringNumber, wide}
 * @param {Function} ctx.rand
 */
export function chooseTarget(ctx) {
  const { rest, dartsLeft, settings, sigma, visit } = ctx;
  const outMode = settings.outMode || 'double';
  if (settings.doubleIn && !ctx.opened) return { seg: 20, mult: 2 };

  // Checkout: dem Tabellenweg folgen (nach jedem Dart neu).
  const route = getCheckoutDarts(rest, dartsLeft, outMode);
  if (route) return route[0];

  // Amateure planen den Stell-Dart oft nicht: dann wird einfach weiter gepunktet bzw. nach Faustregel gestellt.
  const plans = !ctx.rand || ctx.rand() >= noPlanProbability(sigma);

  // Stellen: letzter Dart der Aufnahme, Rest im Finish-Bereich → besten Rest anwerfen.
  if (dartsLeft === 1 && rest <= 170) {
    if (plans) return bestSetup(rest, ctx.visitStart, sigma, outMode);
    if (rest > 60) return visit.wide ? S(visit.scoringNumber || 20) : T(visit.scoringNumber || 20);
    return ruleOfThumbSetup(rest, outMode);
  }

  // Stellen mit mehreren Darts: Scoring würde busten/1 lassen → kleiner werfen.
  if (rest <= 70) return plans ? bestSetup(rest, ctx.visitStart, sigma, outMode) : ruleOfThumbSetup(rest, outMode);

  // Scoring
  const n = visit.scoringNumber || 20;
  if (visit.wide) return S(n);
  return T(n);
}

/** Wahrscheinlichkeit, dass ein Bot einen Stell-Dart nicht optimal plant (stark ≈ 5 %, schwach bis 75 %). */
export function noPlanProbability(sigma) {
  return Math.min(0.75, Math.max(0.05, (sigma - 5) / 30));
}

/** Stellen nach Faustregel: Single anwerfen, das 40, 32, 16 … übrig lässt. */
function ruleOfThumbSetup(rest, outMode) {
  const leaves = outMode === 'double' ? [40, 32, 36, 24, 16, 20, 8] : [];
  for (const l of leaves) {
    const need = rest - l;
    if (need >= 1 && need <= 20) return S(need);
  }
  return S(Math.min(20, Math.max(1, rest - 2)));
}

function bestSetup(rest, visitStart, sigma, outMode) {
  let best = null;
  let bestV = -Infinity;
  const bustValue = leaveQuality(visitStart, outMode) - 3;
  for (const cand of SETUP_CANDIDATES) {
    let v = 0;
    for (const { dart, p } of outcomeDistribution(cand, sigma)) {
      const r = rest - dartPoints(dart);
      if (r < 0 || isDeadRest(r, outMode) || (r === 0 && !isValidFinish(dart, outMode))) v += p * bustValue;
      else if (r === 0) v += p * 200;
      else v += p * leaveQuality(r, outMode);
    }
    if (v > bestV) {
      bestV = v;
      best = cand;
    }
  }
  return best;
}

/** Nach einem Dart: Wechsel von T20 auf T19, wenn der Dart in 1 oder 5 landet. */
export function afterDart(visit, target, result, rand) {
  if (target.seg === 20 && target.mult !== 2 && (result.seg === 1 || result.seg === 5) && rand() < 0.35) {
    visit.scoringNumber = 19;
  }
}

export function newVisit(sigma, rand) {
  return { scoringNumber: 20, wide: rand() < wideAimProbability(sigma) };
}
