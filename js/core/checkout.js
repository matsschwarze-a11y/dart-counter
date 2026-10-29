// Checkout-Wege: Suche mit Profi-Präferenzen + vorberechnete Double-out-Tabelle.
import { dartPoints, dartLabel, parseDart } from './board.js';
import { isValidFinish } from './rules.js';
import { CHECKOUT_TABLE } from './checkout-table.js';

const SINGLES = [...Array(20).keys()].map((i) => ({ seg: i + 1, mult: 1 })).concat([{ seg: 25, mult: 1 }]);
const DOUBLES = [...Array(20).keys()].map((i) => ({ seg: i + 1, mult: 2 })).concat([{ seg: 25, mult: 2 }]);
const TRIPLES = [...Array(20).keys()].map((i) => ({ seg: i + 1, mult: 3 }));
const ALL = [...TRIPLES, ...SINGLES, ...DOUBLES];

// Bevorzugte End-Doppel (Index = Rang), Bull zuletzt.
export const DOUBLE_PREFERENCE = [20, 16, 8, 10, 18, 12, 4, 6, 14, 2, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1, 25];
const TRIPLE_PREFERENCE = { 20: 0, 19: 1, 18: 3, 17: 4, 16: 5 };

function finishRank(d) {
  if (d.mult === 2) return DOUBLE_PREFERENCE.indexOf(d.seg);
  if (d.mult === 3) return 22 + (20 - d.seg) * 0.5; // Master-out: Triple-Finish nach Doppeln
  return 30 + (25 - d.seg) * 0.1; // Straight-out: Single
}

function setupCost(d) {
  if (d.mult === 3) return TRIPLE_PREFERENCE[d.seg] ?? 8 + (20 - d.seg) * 0.3;
  if (d.seg === 25) return d.mult === 2 ? 14 : 12;
  if (d.mult === 2) return 15;
  return 1;
}

function canFinishIn(rest, darts, outMode) {
  return searchRoutes(rest, darts, outMode, false).length > 0;
}

function routeCost(route, rest, outMode) {
  let cost = route.length * 1000 + finishRank(route[route.length - 1]) * 6;
  let r = rest;
  for (let j = 0; j < route.length - 1; j++) {
    const d = route[j];
    cost += setupCost(d);
    // Fehlertoleranz: Trifft der Triple-Dart nur das Single, bleibt noch ein Finish?
    if (d.mult === 3) {
      const left = route.length - 1 - j;
      if (canFinishIn(r - d.seg, left, outMode)) cost -= 3;
    }
    if (j > 0 && dartPoints(d) > dartPoints(route[j - 1])) cost += 0.5;
    r -= dartPoints(d);
  }
  return cost;
}

const searchCache = new Map();

/** Alle Wege mit genau der kleinstmöglichen Dartzahl ≤ maxDarts (ohne Bewertung). */
function searchRoutes(rest, maxDarts, outMode, all = true) {
  const key = `${rest}|${maxDarts}|${outMode}|${all}`;
  if (searchCache.has(key)) return searchCache.get(key);
  const finishers = ALL.filter((d) => isValidFinish(d, outMode));
  const out = [];
  for (let k = 1; k <= maxDarts && !out.length; k++) {
    const rec = (prefix, r) => {
      if (prefix.length === k - 1) {
        for (const f of finishers) if (dartPoints(f) === r) out.push([...prefix, f]);
        return;
      }
      for (const d of ALL) {
        const nr = r - dartPoints(d);
        if (nr < 1) continue;
        if (nr === 1 && outMode !== 'straight') continue;
        prefix.push(d);
        rec(prefix, nr);
        prefix.pop();
        if (!all && out.length) return;
      }
    };
    rec([], rest);
    if (!all && out.length) break;
  }
  searchCache.set(key, out);
  return out;
}

/** Bester Weg nach Präferenzen (ohne Tabelle). Liefert Labels oder null. */
export function computeCheckout(rest, dartsLeft, outMode = 'double') {
  if (rest < 1 || dartsLeft < 1) return null;
  const routes = searchRoutes(rest, dartsLeft, outMode);
  if (!routes.length) return null;
  let best = null;
  let bestCost = Infinity;
  for (const r of routes) {
    const c = routeCost(r, rest, outMode);
    if (c < bestCost) {
      bestCost = c;
      best = r;
    }
  }
  return best.map(dartLabel);
}

/** Checkout-Vorschlag als Label-Liste (z. B. ["T20","T20","BULL"]) oder null. */
export function getCheckout(rest, dartsLeft, outMode = 'double') {
  if (outMode === 'double') {
    const row = CHECKOUT_TABLE[dartsLeft];
    if (row && rest in row) return row[rest].slice();
    if (row && Object.keys(row).length) return null;
  }
  return computeCheckout(rest, dartsLeft, outMode);
}

/** Wie getCheckout, aber als Dart-Objekte. */
export function getCheckoutDarts(rest, dartsLeft, outMode = 'double') {
  const r = getCheckout(rest, dartsLeft, outMode);
  return r ? r.map(parseDart) : null;
}
