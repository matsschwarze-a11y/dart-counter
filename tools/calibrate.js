// Kalibrierung: σ → simulierter 3-Dart-Average (Monte-Carlo ganzer 501-Legs, Double-out,
// inkl. Stellen, Checkout und Busts). Schreibt js/bot/calibration-table.js.
// Aufruf: node tools/calibrate.js [legsProPunkt]
import { writeFileSync } from 'node:fs';
import { simulateMany } from '../js/bot/simulate.js';

const LEGS = Number(process.argv[2] || 6000);
const grid = [];
for (let s = 3; s < 12; s += 0.5) grid.push(s);
for (let s = 12; s <= 40; s += 1) grid.push(s);

const points = [];
for (const [i, sigma] of grid.entries()) {
  const r = simulateMany(sigma, LEGS, { seed: 1000 + i });
  points.push({ sigma, average: r.average, checkoutRate: r.checkoutRate });
  console.log(`σ ${sigma.toFixed(1).padStart(5)} mm → Ø ${r.average.toFixed(2).padStart(6)}  Checkout ${(r.checkoutRate * 100).toFixed(1)} %`);
}

// Monotonie erzwingen (Average fällt mit wachsendem σ): Pool-Adjacent-Violators.
const blocks = points.map((p) => ({ sum: p.average, n: 1 }));
for (let i = 0; i < blocks.length - 1; ) {
  const a = blocks[i], b = blocks[i + 1];
  if (a.sum / a.n < b.sum / b.n) {
    blocks.splice(i, 2, { sum: a.sum + b.sum, n: a.n + b.n });
    if (i > 0) i--;
  } else i++;
}
const smooth = [];
for (const b of blocks) for (let k = 0; k < b.n; k++) smooth.push(b.sum / b.n);

const table = points.map((p, i) => [Number(smooth[i].toFixed(2)), p.sigma]);
const out = `// GENERIERT von tools/calibrate.js (${LEGS} Legs je Stützstelle) – nicht von Hand ändern.
// Stützstellen [3-Dart-Average, σ in mm], Average absteigend.
export const CALIBRATION = ${JSON.stringify(table)};

export const MIN_AVERAGE = 25;
export const MAX_AVERAGE = 100;

/** σ (mm) für einen Ziel-Average, linear zwischen den Stützstellen interpoliert. */
export function sigmaForAverage(avg) {
  const t = CALIBRATION;
  if (avg >= t[0][0]) return t[0][1];
  if (avg <= t[t.length - 1][0]) return t[t.length - 1][1];
  for (let i = 0; i < t.length - 1; i++) {
    const [a1, s1] = t[i];
    const [a2, s2] = t[i + 1];
    if (avg <= a1 && avg >= a2) {
      if (a1 === a2) return (s1 + s2) / 2;
      return s1 + ((a1 - avg) / (a1 - a2)) * (s2 - s1);
    }
  }
  return t[t.length - 1][1];
}
`;
writeFileSync(new URL('../js/bot/calibration-table.js', import.meta.url), out);
console.log('Kalibrierungstabelle geschrieben.');
