// Wurfmodell: Zielpunkt + bivariate Normalverteilung, Umrechnung in ein Feld.
import { aimPoint, pointToDart } from '../core/board.js';
import { gaussian } from '../core/rng.js';

export const SIGMA_Y_FACTOR = 1.2; // Menschen streuen vertikal stärker

/** Wirft einen Dart auf `target` ({seg, mult, area?}) mit Streuung sigma (mm, horizontal). */
export function throwAt(target, sigma, rand) {
  const aim = aimPoint(target, { singleArea: target.area || 'big' });
  const x = aim.x + gaussian(rand) * sigma;
  const y = aim.y + gaussian(rand) * sigma * SIGMA_Y_FACTOR;
  return pointToDart(x, y);
}

/** Form-Faktor pro Leg: σ schwankt um ca. ±5 %, begrenzt auf ±10 %. */
export function legForm(rand) {
  return Math.min(1.1, Math.max(0.9, 1 + gaussian(rand) * 0.05));
}

const outcomeCache = new Map();
const CACHE_SAMPLES = 1500;

/**
 * Trefferverteilung für (target, sigma) als Liste [{dart, p}], per Monte-Carlo
 * mit festem Seed geschätzt und gecacht (σ auf 0,5 mm gerundet).
 */
export function outcomeDistribution(target, sigma) {
  const s = Math.round(sigma * 2) / 2;
  const key = `${target.seg}|${target.mult}|${target.area || 'big'}|${s}`;
  let dist = outcomeCache.get(key);
  if (dist) return dist;
  // deterministischer, schneller PRNG nur für die Verteilung
  let a = 0x9e3779b9 ^ (target.seg * 131 + target.mult * 17 + Math.round(s * 10));
  const rand = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const counts = new Map();
  for (let i = 0; i < CACHE_SAMPLES; i++) {
    const d = throwAt(target, s, rand);
    const k = d.seg * 4 + d.mult;
    const c = counts.get(k);
    if (c) c.n++;
    else counts.set(k, { dart: d, n: 1 });
  }
  dist = [...counts.values()].map(({ dart, n }) => ({ dart, p: n / CACHE_SAMPLES }));
  if (outcomeCache.size > 20000) outcomeCache.clear();
  outcomeCache.set(key, dist);
  return dist;
}
