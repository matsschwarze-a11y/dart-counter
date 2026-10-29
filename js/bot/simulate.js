// Simulation ganzer Legs (Solo) für Kalibrierung, Entwickler-Seite und Tests.
import { applyDart } from '../core/rules.js';
import { mulberry32 } from '../core/rng.js';
import { throwAt, legForm } from './throw-model.js';
import { chooseTarget, afterDart, newVisit } from './strategy.js';

const MAX_VISITS = 150;

/** Wählt den nächsten Bot-Dart (Ziel + Ergebnis). */
export function botDart({ rest, dartsLeft, visitStart, opened, settings, sigma, visit, rand }) {
  const target = chooseTarget({ rest, dartsLeft, visitStart, opened, settings, sigma, visit, rand });
  const result = throwAt(target, sigma, rand);
  afterDart(visit, target, result, rand);
  return { target, result };
}

/** Simuliert ein Solo-Leg. Liefert Aufnahmen mit Darts. */
export function simulateLeg(sigmaBase, settings, rand) {
  const s = { startScore: 501, outMode: 'double', doubleIn: false, ...settings };
  const sigma = sigmaBase * legForm(rand);
  let rest = s.startScore;
  let opened = !s.doubleIn;
  const visits = [];
  while (visits.length < MAX_VISITS) {
    const visitStart = rest;
    const openedStart = opened;
    const visit = newVisit(sigma, rand);
    const v = { start: rest, score: 0, darts: [], bust: false, checkout: false };
    for (let k = 0; k < 3; k++) {
      const { result } = botDart({ rest, dartsLeft: 3 - k, visitStart, opened, settings: s, sigma, visit, rand });
      const r = applyDart({ rest, opened }, result, s);
      v.darts.push({ ...result, doubleAttempt: r.doubleAttempt, checkout: r.checkout, bust: r.bust });
      if (r.bust) {
        v.bust = true;
        rest = visitStart;
        opened = openedStart;
        v.score = 0;
        break;
      }
      rest = r.rest;
      opened = r.opened;
      v.score += r.points;
      if (r.checkout) {
        v.checkout = true;
        break;
      }
    }
    visits.push(v);
    if (v.checkout) break;
  }
  return { visits, finished: rest === 0 || visits[visits.length - 1].checkout };
}

/** Aggregierte Kennzahlen über viele Legs. */
export function simulateMany(sigma, legs, { seed = 1, settings = {} } = {}) {
  const rand = mulberry32(seed);
  let points = 0, darts = 0, f9Points = 0, f9Darts = 0, attempts = 0, checkouts = 0;
  let v60 = 0, v100 = 0, v140 = 0, v180 = 0, visitsTotal = 0;
  let minDarts = Infinity, maxDarts = 0;
  const hist = new Array(19).fill(0); // Aufnahmen nach 10er-Bändern 0–9, 10–19, … 180
  const dartsPerLeg = [];
  for (let i = 0; i < legs; i++) {
    const leg = simulateLeg(sigma, settings, rand);
    let ld = 0;
    leg.visits.forEach((v, idx) => {
      points += v.score;
      darts += v.darts.length;
      ld += v.darts.length;
      if (idx < 3) {
        f9Points += v.score;
        f9Darts += v.darts.length;
      }
      for (const d of v.darts) if (d.doubleAttempt) attempts++;
      if (v.checkout) checkouts++;
      visitsTotal++;
      if (v.score >= 60) v60++;
      if (v.score >= 100) v100++;
      if (v.score >= 140) v140++;
      if (v.score === 180) v180++;
      hist[Math.min(18, Math.floor(v.score / 10))]++;
    });
    dartsPerLeg.push(ld);
    minDarts = Math.min(minDarts, ld);
    maxDarts = Math.max(maxDarts, ld);
  }
  return {
    legs,
    average: (points / darts) * 3,
    first9: (f9Points / f9Darts) * 3,
    checkoutRate: attempts ? checkouts / attempts : 0,
    checkouts,
    attempts,
    pct60: v60 / visitsTotal,
    pct100: v100 / visitsTotal,
    pct140: v140 / visitsTotal,
    pct180: v180 / visitsTotal,
    dartsPerLeg: darts / legs,
    minDarts,
    maxDarts,
    histogram: hist.map((n) => n / visitsTotal),
  };
}
